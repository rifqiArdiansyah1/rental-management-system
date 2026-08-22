'use server'

import { requireAdminSession } from '@/actions/admin'
import { createAdminClient } from '@/utils/supabase/admin'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
const BUCKET_NAME = 'vehicle-photos'

export async function uploadVehiclePhoto(formData: FormData) {
  try {
    const adminUser = await requireAdminSession()
    if (!adminUser) {
      return { error: 'Unauthorized' }
    }

    const file = formData.get('file') as File | null
    if (!file) {
      return { error: 'File gambar wajib dipilih' }
    }

    if (file.size > MAX_FILE_SIZE) {
      return { error: 'Ukuran file gambar maksimal 5MB' }
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return { error: 'Format file tidak didukung (hanya JPG, PNG, WebP)' }
    }

    const adminClient = createAdminClient()

    // Ensure bucket exists or handle upload
    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`
    const filePath = `armada/${fileName}`

    const { error: uploadError } = await adminClient.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      // If bucket doesn't exist, attempt to create it as public
      if (uploadError.message?.includes('Bucket not found') || (uploadError as any).statusCode === 404) {
        await adminClient.storage.createBucket(BUCKET_NAME, {
          public: true
        })

        // Retry upload
        const { error: retryError } = await adminClient.storage
          .from(BUCKET_NAME)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (retryError) {
          console.error('Storage retry upload error:', retryError)
          return { error: 'Gagal mengunggah foto ke penyimpanan' }
        }
      } else {
        console.error('Storage upload error:', uploadError)
        return { error: 'Gagal mengunggah foto ke penyimpanan' }
      }
    }

    const { data: publicUrlData } = adminClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath)

    return { success: true, publicUrl: publicUrlData.publicUrl }
  } catch (error: any) {
    console.error('Failed to upload vehicle photo:', error)
    return { error: error.message || 'Terjadi kesalahan saat upload foto' }
  }
}
