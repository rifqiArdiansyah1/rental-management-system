import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/utils/prisma'

/**
 * GET /api/document/preview?type=ktp|sim
 *
 * Generates a 5-minute Signed URL for the customer's own KTP or SIM document.
 * Authorization is handled by Supabase RLS ("Users can read own files") —
 * no additional server-side scope validation needed for self-access.
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

  // Find the document record
  const doc = await prisma.document.findFirst({
    where: { customerId: user.id, type }
  })

  if (!doc || !doc.fileUrl) {
    return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })
  }

  // Extract the storage path from the fileUrl
  // fileUrl format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const bucketName = 'customer-documents'
  const urlParts = doc.fileUrl.split(`/${bucketName}/`)
  if (urlParts.length < 2) {
    return NextResponse.json({ error: 'Format URL dokumen tidak valid.' }, { status: 500 })
  }
  const storagePath = urlParts[1]

  // Generate 5-minute signed URL using the user's own session (RLS enforces ownership)
  const { data: signedData, error: signedError } = await supabase
    .storage
    .from(bucketName)
    .createSignedUrl(storagePath, 300) // 300 seconds = 5 minutes

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Gagal membuat URL pratinjau.' }, { status: 500 })
  }

  return NextResponse.json({ url: signedData.signedUrl })
}
