const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Booking" CASCADE');
  console.log("Truncated Booking table");
}
main();
