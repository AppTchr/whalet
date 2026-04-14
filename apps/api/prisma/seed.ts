import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean up in correct order (respect FK constraints)
  await prisma.authSession.deleteMany();
  await prisma.userOtp.deleteMany();
  await prisma.user.deleteMany();

  // Seed a dev user for local testing
  const devUser = await prisma.user.create({
    data: {
      email: 'dev@ledger.local',
      status: 'active',
    },
  });

  console.log(`Created dev user: ${devUser.email} (id: ${devUser.id})`);
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
