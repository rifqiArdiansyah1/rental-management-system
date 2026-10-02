import { prisma } from '@/utils/prisma'
import { PrismaClient, VerificationStatus } from '@prisma/client'

type PrismaClientOrTx = PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

/**
 * Sinkronisasi status verifikasi KYC pelanggan berdasarkan kelengkapan dokumen KTP dan SIM.
 * Aturan Kanonikal (Single Source of Truth):
 * - HANYA 'verified' jika kedua dokumen (KTP dan SIM) terunggah dan verifiedAt !== null.
 * - 'rejected' jika terdapat dokumen yang ditolak (rejectionReason !== null atau explicit statusHint === 'rejected').
 * - Selain itu berstatus 'pending'.
 */
export async function syncCustomerVerificationStatus(
  customerId: string,
  tx?: PrismaClientOrTx,
  forcedStatusHint?: 'verified' | 'rejected' | 'pending'
): Promise<VerificationStatus> {
  const db = tx || prisma

  const allCustomerDocs = await db.document.findMany({
    where: { customerId }
  })

  const hasVerifiedKTP = allCustomerDocs.some(
    (d) => d.type.toLowerCase() === 'ktp' && d.verifiedAt !== null
  )
  const hasVerifiedSIM = allCustomerDocs.some(
    (d) => d.type.toLowerCase() === 'sim' && d.verifiedAt !== null
  )
  const hasRejectedDoc = allCustomerDocs.some(
    (d) => d.rejectionReason !== null
  )

  let nextStatus: VerificationStatus = 'pending'

  if (hasVerifiedKTP && hasVerifiedSIM) {
    nextStatus = 'verified'
  } else if (hasRejectedDoc || forcedStatusHint === 'rejected') {
    nextStatus = 'rejected'
  } else {
    nextStatus = 'pending'
  }

  await db.customer.update({
    where: { id: customerId },
    data: { verificationStatus: nextStatus }
  })

  return nextStatus
}
