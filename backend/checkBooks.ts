import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.book.count();
  console.log('Total books in database:', count);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Error:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
