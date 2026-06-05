require('dotenv').config({ path: __dirname + '/../.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

(async () => {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'akash@gmail.com' } });
    console.log('USER:', user);
    await prisma.$disconnect();
  } catch (err) {
    console.error('ERROR:', err);
    try { await prisma.$disconnect(); } catch {};
    process.exit(1);
  }
})();
