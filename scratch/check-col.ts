import { prisma } from '../src/utils/prisma';

async function main() {
  try {
    const res = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Booking' AND column_name = 'cancellationNote';
    `;
    console.log("DB check result:", res);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
