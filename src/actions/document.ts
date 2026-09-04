'use server'

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/utils/prisma'
import { createAdminClient } from '@/utils/supabase/admin'
import { getStaffScope } from '@/lib/auth/scope'
import { logAudit } from '@/lib/audit'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

export async function uploadIdentityDocument(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  const file = formData.get('file') as File | null
  const type = formData.get('type') as string // 'ktp' or 'sim'
  const identityNumber = formData.get('identityNumber') as string

  if (!file || !type || !identityNumber) {
    return { error: 'Semua field wajib diisi' }
  }

  if (type !== 'ktp' && type !== 'sim') {
    return { error: 'Tipe dokumen tidak valid' }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: 'Ukuran file maksimal 5MB' }
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: 'Format file tidak didukung (hanya JPG, PNG, PDF)' }
  }

  // 1. Upload ke Storage Supabase
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}_${type}.${fileExt}`
  const filePath = `${user.id}/${fileName}`

  const adminClient = createAdminClient()
  const { error: uploadError } = await adminClient.storage
    .from('documents')
    .upload(filePath, file, {
      upsert: false
    })

  if (uploadError) {
    console.error('Storage Upload Error:', uploadError)
    return { error: 'Gagal mengunggah dokumen ke penyimpanan' }
  }

  // 2. Transaksi Database
  try {
    await prisma.$transaction(async (tx) => {
      // Upsert Document (supersede jika sudah ada)
      const existingDoc = await tx.document.findFirst({
        where: { customerId: user.id, type }
      })

      if (existingDoc) {
        await tx.document.update({
          where: { id: existingDoc.id },
          data: { fileUrl: filePath, updatedAt: new Date(), verifiedAt: null }
        })
      } else {
        await tx.document.create({
          data: {
            type,
            fileUrl: filePath,
            customerId: user.id
          }
        })
      }

      // Update Customer record (reset verificationStatus)
      await tx.customer.update({
        where: { id: user.id },
        data: {
          ...(type === 'ktp' ? { ktpNumber: identityNumber } : { simNumber: identityNumber }),
          verificationStatus: 'pending' // Force verification reset
        }
      })
    })

    return { success: true }
  } catch (dbError: any) {
    console.error('Database Error:', dbError)
    
    if (dbError.code === 'P2002') {
      return { error: `Nomor ${type.toUpperCase()} ini sudah terdaftar pada akun lain.` }
    }

    return { error: 'Gagal menyimpan data ke sistem' }
  }
}

export async function generateSignedDocumentUrl(fileUrl: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Validasi Otorisasi: Apakah user ini pemilik file, atau seorang admin?
  // 1. Ambil data dokumen dari prisma
  const targetDocument = await prisma.document.findFirst({
    where: { fileUrl }
  })

  if (!targetDocument) {
    return { error: 'Dokumen tidak ditemukan' }
  }

  if (!targetDocument.customerId) {
    return { error: 'Dokumen tidak memiliki relasi pelanggan' }
  }

  let isAuthorized = false

  if (targetDocument.customerId === user.id) {
    // User adalah pemilik file
    isAuthorized = true
  } else {
    // Cek apakah user adalah admin dan periksa scope-nya
    try {
      const scope = await getStaffScope()
      
      if (scope.scope === 'all') {
        isAuthorized = true
      } else {
        // Staff/Admin cabang: cek apakah ada pesanan aktif dari customer ini di cabangnya
        const activeBooking = await prisma.booking.findFirst({
          where: { 
            customerId: targetDocument.customerId, 
            pickupBranchId: scope.branchId,
            status: { in: ['pending_payment', 'confirmed', 'ongoing'] }
          }
        })
        
        if (activeBooking) {
          isAuthorized = true
        }
      }
    } catch (err: any) {
      // Jika getStaffScope melempar error (misal branchId kosong), anggap tidak berwenang
      isAuthorized = false
    }
  }

  // Ambil konteks cabang target dari pesanan customer
  const targetBooking = await prisma.booking.findFirst({
    where: { customerId: targetDocument.customerId },
    orderBy: { createdAt: 'desc' }
  })
  const targetBranchId = targetBooking?.pickupBranchId ?? null

  if (!isAuthorized) {
    const actorUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (actorUser) {
      logAudit({
        actorId: actorUser.id,
        actorRole: actorUser.role,
        branchId: targetBranchId,
        action: 'document.view_denied',
        entityType: 'Document',
        entityId: targetDocument.id,
        metadata: {
          reason: 'Cross-branch access denied',
          documentType: targetDocument.type,
          customerId: targetDocument.customerId,
          requestedFileUrl: fileUrl
        }
      })
    }
    return { error: 'Anda tidak memiliki akses ke dokumen ini' }
  }

  try {
    let storagePath = fileUrl
    const bucketName = 'documents'

    // Handle case where fileUrl is a full URL
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      if (!storagePath.includes(`/${bucketName}/`)) {
        // External URL (e.g. mock seeds or external CDN)
        return { url: storagePath }
      }
      const urlParts = storagePath.split(`/${bucketName}/`)
      storagePath = urlParts[1]
    }

    // Generate signed URL via Service Role
    const adminClient = createAdminClient()
    const { data, error } = await adminClient.storage
      .from(bucketName)
      .createSignedUrl(storagePath, 5 * 60) // Berlaku 5 menit

    if (error || !data) {
      console.error('Signed URL Error:', error)
      return { error: 'Gagal membuat tautan akses' }
    }

    // Catat audit log jika diakses oleh akun internal (bukan oleh customer pemilik sendiri)
    if (targetDocument.customerId !== user.id) {
      const actorUser = await prisma.user.findUnique({ where: { id: user.id } })
      if (actorUser) {
        logAudit({
          actorId: actorUser.id,
          actorRole: actorUser.role,
          branchId: targetBranchId,
          action: 'document.view',
          entityType: 'Document',
          entityId: targetDocument.id,
          metadata: {
            documentType: targetDocument.type,
            customerId: targetDocument.customerId,
            expiresInSeconds: 300
          }
        })
      }
    }

    return { url: data.signedUrl }
  } catch (err: any) {
    return { error: 'Konfigurasi admin belum tersedia' }
  }
}
