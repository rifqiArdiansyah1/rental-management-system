import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { prisma } from '@/utils/prisma'

/**
 * GET /api/document/preview?type=ktp|sim
 *
 * Generates a 5-minute Signed URL for the customer's own KTP or SIM document.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const type = req.nextUrl.searchParams.get('type')
  if (type !== 'ktp' && type !== 'sim') {
    return NextResponse.json({ error: 'Parameter type harus ktp atau sim.' }, { status: 400 })
  }

  // Find the document record belonging to the authenticated customer
  const doc = await prisma.document.findFirst({
    where: { customerId: user.id, type }
  })

  if (!doc || !doc.fileUrl) {
    return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })
  }

  const bucketName = 'documents'
  let storagePath = doc.fileUrl

  // Handle case where fileUrl is stored as a full URL
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    if (!storagePath.includes(`/${bucketName}/`)) {
      // External mock URL (e.g. from test seeds or mock storage)
      return NextResponse.json({ url: storagePath })
    }
    const urlParts = storagePath.split(`/${bucketName}/`)
    storagePath = urlParts[1]
  }

  try {
    const adminClient = createAdminClient()
    const { data: signedData, error: signedError } = await adminClient
      .storage
      .from(bucketName)
      .createSignedUrl(storagePath, 300) // 300 seconds = 5 minutes

    if (signedError || !signedData?.signedUrl) {
      console.error('Storage signedUrl error:', signedError)
      return NextResponse.json({ error: 'Gagal membuat URL pratinjau.' }, { status: 500 })
    }

    return NextResponse.json({ url: signedData.signedUrl })
  } catch (err: any) {
    console.error('Error generating document preview URL:', err)
    return NextResponse.json({ error: 'Terjadi kesalahan sistem saat memproses pratinjau dokumen.' }, { status: 500 })
  }
}
