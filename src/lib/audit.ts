import { prisma } from '@/utils/prisma'
import { UserRole, Prisma } from '@prisma/client'

export interface LogAuditParams {
  actorId: string
  actorRole: UserRole
  branchId?: string | null // Konteks cabang target entity
  action: string
  entityType: 'Booking' | 'Vehicle' | 'Driver' | 'Branch' | 'User' | 'Document' | 'Customer' | 'DriverLeave'
  entityId: string
  metadata?: Prisma.InputJsonValue
}

/**
 * Mencatat audit log secara resilient di luar transaksi DB utama.
 * Kegagalan insert audit log tidak akan menggagalkan operasi bisnis utama.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        actorRole: params.actorRole,
        branchId: params.branchId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata || Prisma.DbNull
      }
    })
  } catch (error) {
    console.error(`[AUDIT_LOG_ERROR] Gagal menyimpan audit log untuk aksi "${params.action}" pada ${params.entityType}:${params.entityId}:`, error)
  }
}
