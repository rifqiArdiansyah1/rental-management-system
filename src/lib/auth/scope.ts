import { requireAdminSession } from '@/actions/admin'

export type StaffScope = 
  | { scope: 'all' }
  | { scope: 'branch'; branchId: string };

/**
 * Mendapatkan wewenang cabang dari staf yang sedang login.
 * Mengambil data dari requireAdminSession() yang sudah memvalidasi peran.
 */
export async function getStaffScope(): Promise<StaffScope> {
  const user = await requireAdminSession();
  
  if (user.role === 'admin_pusat') {
    return { scope: 'all' };
  }
  
  if (!user.branchId) {
    throw new Error('Akun Anda belum terhubung ke cabang manapun. Silakan hubungi admin pusat untuk konfigurasi akses.');
  }
  
  return { scope: 'branch', branchId: user.branchId };
}

/**
 * Validasi apakah entitas cabang (satu atau beberapa) berada dalam scope wewenang staf.
 * Melempar error jika staf mencoba mengakses entitas di luar cabangnya.
 * 
 * @param entityBranchIds Daftar ID cabang yang relevan dengan transaksi (misal: pickupBranchId dan returnBranchId)
 * @param scope Wewenang staf (didapat dari getStaffScope)
 */
export function assertInScope(entityBranchIds: (string | null | undefined)[], scope: StaffScope): void {
  if (scope.scope === 'all') {
    return; // Admin pusat bebas akses ke semua cabang
  }
  
  // Hapus entitas null/undefined
  const validBranchIds = entityBranchIds.filter(Boolean) as string[];
  
  if (validBranchIds.length === 0) {
    // Jika entitas tidak terkait dengan cabang manapun, izinkan atau tolak?
    // Dalam konteks rental (booking, mobil, sopir), entitas SELALU punya cabang.
    // Jika tidak ada, tolak sebagai bentuk kehati-hatian.
    throw new Error('Akses ditolak: Entitas ini tidak terhubung dengan cabang valid.');
  }
  
  // Staf cabang HANYA berwenang jika SETIDAKNYA SATU dari cabang entitas terkait
  // cocok dengan cabang staf. (Contoh: endRental, staf A bisa selesai jika pickup/return di A).
  const isAuthorized = validBranchIds.some(branchId => branchId === scope.branchId);
  
  if (!isAuthorized) {
    throw new Error('Akses ditolak: Anda tidak memiliki wewenang untuk mengelola data di luar cabang Anda.');
  }
}

/**
 * Membangun kondisi `where` Prisma untuk memfilter data berdasarkan scope cabang.
 * 
 * @param branchField Nama field branch di Prisma schema (default: 'branchId')
 */
export function buildScopeWhere(scope: StaffScope, branchField: string = 'branchId') {
  if (scope.scope === 'all') {
    return {};
  }
  return { [branchField]: scope.branchId };
}
