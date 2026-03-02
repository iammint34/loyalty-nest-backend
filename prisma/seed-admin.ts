import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@chixinasal.com' },
    update: { passwordHash },
    create: {
      email: 'admin@chixinasal.com',
      passwordHash,
      role: 'super_admin',
      firstName: 'Admin',
      lastName: 'ChixInasal',
    },
  });

  console.log(`Seeded admin user: ${admin.email} (${admin.role})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
