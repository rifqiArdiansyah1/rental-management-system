import { prisma } from '../src/utils/prisma';

async function main() {
  const booking = await prisma.booking.findFirst({
    where: { vehicle: { plateNumber: { startsWith: 'TEST-CANCEL-' } } },
    include: { payments: true }
  });
  console.log("Booking Status:", booking?.status);
  console.log("Payments:", JSON.stringify(booking?.payments, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
