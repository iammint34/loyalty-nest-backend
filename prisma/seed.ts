import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ─── Constants ───────────────────────────────────────────────────────────────

const POINTS_PER_CURRENCY_UNIT = 100;
const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const BRANCHES = [
  { code: 'CEBU-001', weight: 35 },
  { code: 'MANDAUE-001', weight: 25 },
  { code: 'LAPU-001', weight: 15 },
  { code: 'TALISAY-001', weight: 15 },
  { code: 'MANILA-001', weight: 10 },
];

const MENU_ITEMS = [
  { name: 'Chicken Inasal Paa', price: 149 },
  { name: 'Chicken Inasal Pecho', price: 169 },
  { name: 'Liempo Inasal', price: 179 },
  { name: 'Bangus Inasal', price: 159 },
  { name: 'Plain Rice', price: 35 },
  { name: 'Garlic Rice', price: 45 },
  { name: 'Java Rice', price: 45 },
  { name: 'Iced Tea', price: 49 },
  { name: 'Sago Gulaman', price: 55 },
  { name: 'Halo-Halo', price: 89 },
  { name: 'Extra Sauce', price: 15 },
  { name: 'Batchoy', price: 99 },
  { name: 'Pancit Canton', price: 89 },
  { name: 'Sinigang na Baboy', price: 199 },
];

const FILIPINO_FIRST_NAMES = [
  'Maria', 'Jose', 'Juan', 'Ana', 'Pedro', 'Rosa', 'Carlos', 'Elena',
  'Miguel', 'Carmen', 'Rafael', 'Teresa', 'Antonio', 'Luz', 'Francisco',
  'Isabel', 'Manuel', 'Gloria', 'Ricardo', 'Cristina', 'Roberto', 'Patricia',
  'Eduardo', 'Rosario', 'Arturo', 'Angelica', 'Fernando', 'Dolores', 'Ernesto',
  'Beatriz', 'Alfredo', 'Cynthia', 'Reynaldo', 'Maricel', 'Danilo', 'Jennifer',
  'Rolando', 'Marites', 'Jessie', 'Cherry', 'Dennis', 'Aileen', 'Joel',
  'Rochelle', 'Mark', 'Grace', 'Kenneth', 'Joyce', 'Christian', 'Nicole',
];

const FILIPINO_LAST_NAMES = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Gonzales', 'Garcia', 'Mendoza',
  'Torres', 'Villanueva', 'Ramos', 'Aquino', 'Castillo', 'Rivera', 'Flores',
  'Lopez', 'Dela Cruz', 'Pascual', 'Navarro', 'Mercado', 'Tan', 'Lim',
  'Ong', 'Go', 'Sy', 'Chua', 'Fernandez', 'Morales', 'Hernandez', 'Perez',
  'Santiago', 'Soriano', 'Salazar', 'Aguilar', 'Dizon', 'Manalo', 'De Leon',
  'Rosales', 'Valdez', 'Ocampo', 'Magno', 'Tolentino', 'Concepcion', 'Pineda',
  'Pangilinan', 'Dimaculangan', 'Magsaysay', 'Del Rosario', 'Evangelista',
  'Espiritu', 'Sotto',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted(items: { code: string; weight: number }[]): string {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.code;
  }
  return items[items.length - 1].code;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(rand(8, 21), rand(0, 59), rand(0, 59), 0);
  return d;
}

function generateRedemptionCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += SAFE_CHARS.charAt(Math.floor(Math.random() * SAFE_CHARS.length));
  }
  return `RDM-${code}`;
}

function generateOrderItems(): { name: string; quantity: number; price: number }[] {
  const numItems = rand(2, 5);
  const items: { name: string; quantity: number; price: number }[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < numItems; i++) {
    let item: (typeof MENU_ITEMS)[number];
    do {
      item = pick(MENU_ITEMS);
    } while (usedNames.has(item.name));
    usedNames.add(item.name);
    items.push({
      name: item.name,
      quantity: item.name.includes('Rice') || item.name === 'Extra Sauce' ? rand(1, 3) : rand(1, 2),
      price: item.price,
    });
  }
  return items;
}

function generatePhoneNumber(): string {
  const prefixes = ['917', '918', '919', '920', '921', '926', '927', '928', '929', '936', '937', '938', '939', '946', '947', '948', '949', '950', '951', '961', '963', '965', '966', '975', '976', '977', '978', '995', '996', '997'];
  return `+63${pick(prefixes)}${String(rand(1000000, 9999999))}`;
}

// Replicate promotions.engine.ts logic for seeded data
function calculatePointsForSeed(
  orderAmount: number,
  transactionDate: Date,
  promotions: {
    id: string;
    type: string;
    isActive: boolean;
    startDate: Date;
    endDate: Date;
    rules: { minSpend: number; pointsAwarded: number; multiplier: number; dayOfWeek: string | null }[];
  }[],
): { pointsEarned: number; promotionId: string | null } {
  const basePoints = Math.floor(orderAmount / POINTS_PER_CURRENCY_UNIT);
  const txDay = DAYS_OF_WEEK[transactionDate.getDay()];

  let bestPoints = basePoints;
  let bestPromotionId: string | null = null;

  for (const promo of promotions) {
    // Check if promotion was active at transaction time
    if (transactionDate < promo.startDate || transactionDate > promo.endDate) continue;

    for (const rule of promo.rules) {
      if (orderAmount < rule.minSpend) continue;
      if (rule.dayOfWeek && rule.dayOfWeek !== txDay) continue;

      let points: number;
      switch (promo.type) {
        case 'standard':
          points = rule.pointsAwarded;
          break;
        case 'multiplier':
          points = Math.floor(basePoints * rule.multiplier);
          break;
        case 'bonus':
          points = basePoints + rule.pointsAwarded;
          break;
        default:
          continue;
      }

      if (points > bestPoints) {
        bestPoints = points;
        bestPromotionId = promo.id;
      }
    }
  }

  return { pointsEarned: bestPoints, promotionId: bestPromotionId };
}

// ─── Main Seed ───────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding demo data...\n');

  // ── Step 0: Clean all tables in reverse-FK order ───────────────────────────
  console.log('🗑️  Clearing existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.redemption.deleteMany();
  await prisma.qrCode.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.promotionRule.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.reward.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.adminUser.deleteMany();
  console.log('   Done.\n');

  // ── Step 1: Admin Users ────────────────────────────────────────────────────
  console.log('👤 Seeding admin users...');
  const passwordHash = await bcrypt.hash('admin123', 10);

  const adminData = [
    { email: 'admin@chixinasal.com', firstName: 'Super', lastName: 'Admin', role: 'super_admin' },
    { email: 'maria.santos@chixinasal.com', firstName: 'Maria', lastName: 'Santos', role: 'admin' },
    { email: 'jose.reyes@chixinasal.com', firstName: 'Jose', lastName: 'Reyes', role: 'admin' },
  ];

  const admins: { id: string; email: string }[] = [];
  for (const a of adminData) {
    const admin = await prisma.adminUser.create({
      data: { ...a, passwordHash },
    });
    admins.push({ id: admin.id, email: admin.email });
    console.log(`   Created: ${admin.email} (${a.role})`);
  }

  // ── Step 2: Customers (50) ─────────────────────────────────────────────────
  console.log('\n👥 Seeding customers...');
  const now = new Date();

  // Growth pattern: 10 month-1 (90-61 days ago), 15 month-2 (60-31 days ago), 25 month-3 (30-0 days ago)
  const customerSignupRanges: { count: number; startDaysAgo: number; endDaysAgo: number }[] = [
    { count: 10, startDaysAgo: 90, endDaysAgo: 61 },
    { count: 15, startDaysAgo: 60, endDaysAgo: 31 },
    { count: 25, startDaysAgo: 30, endDaysAgo: 1 },
  ];

  const usedPhones = new Set<string>();
  const customerIds: string[] = [];
  const customerCreatedDates: Date[] = [];

  for (const range of customerSignupRanges) {
    for (let i = 0; i < range.count; i++) {
      let phone: string;
      do {
        phone = generatePhoneNumber();
      } while (usedPhones.has(phone));
      usedPhones.add(phone);

      const createdAt = daysAgo(rand(range.endDaysAgo, range.startDaysAgo));
      const idx = customerIds.length;

      const customer = await prisma.customer.create({
        data: {
          firstName: FILIPINO_FIRST_NAMES[idx],
          lastName: FILIPINO_LAST_NAMES[idx],
          phoneNumber: phone,
          totalPoints: 0,
          availablePoints: 0,
          isActive: true,
          createdAt,
        },
      });
      customerIds.push(customer.id);
      customerCreatedDates.push(createdAt);
    }
  }
  console.log(`   Created ${customerIds.length} customers.`);

  // Define customer tiers (indices into customerIds)
  // 5 power users (idx 0-4), ~35 regular (idx 5-39), ~7 light (idx 40-46), 3 inactive (idx 47-49)
  const powerUserIndices = [0, 1, 2, 3, 4];
  const regularUserIndices = Array.from({ length: 35 }, (_, i) => i + 5);
  const lightUserIndices = Array.from({ length: 7 }, (_, i) => i + 40);
  const inactiveUserIndices = [47, 48, 49];

  // Deactivate inactive customers
  for (const idx of inactiveUserIndices) {
    await prisma.customer.update({
      where: { id: customerIds[idx] },
      data: { isActive: false },
    });
  }

  // ── Step 3: Promotions + Rules ─────────────────────────────────────────────
  console.log('\n🎉 Seeding promotions & rules...');

  const promoSeedData = [
    {
      name: 'Weekend Double Points',
      description: 'Earn double points on all orders every Saturday and Sunday!',
      type: 'multiplier',
      isActive: true,
      startDate: daysAgo(85),
      endDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      rules: [
        { minSpend: 0, pointsAwarded: 0, multiplier: 2.0, dayOfWeek: 'saturday' },
        { minSpend: 0, pointsAwarded: 0, multiplier: 2.0, dayOfWeek: 'sunday' },
      ],
    },
    {
      name: 'Big Spender Bonus',
      description: 'Spend PHP 1,000 or more and earn 5 bonus points on top of your regular points!',
      type: 'bonus',
      isActive: true,
      startDate: daysAgo(70),
      endDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
      rules: [
        { minSpend: 1000, pointsAwarded: 5, multiplier: 1.0, dayOfWeek: null },
      ],
    },
    {
      name: 'Grand Opening Lapu-Lapu',
      description: 'Triple points to celebrate our new Lapu-Lapu branch!',
      type: 'multiplier',
      isActive: false,
      startDate: daysAgo(80),
      endDate: daysAgo(50),
      rules: [
        { minSpend: 0, pointsAwarded: 0, multiplier: 3.0, dayOfWeek: null },
      ],
    },
    {
      name: 'Friday Fiesta',
      description: 'Kick off the weekend with 3 bonus points on orders over PHP 500 every Friday!',
      type: 'bonus',
      isActive: true,
      startDate: daysAgo(60),
      endDate: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000),
      rules: [
        { minSpend: 500, pointsAwarded: 3, multiplier: 1.0, dayOfWeek: 'friday' },
      ],
    },
    {
      name: 'Loyalty Launch Reward',
      description: 'Flat 15 points for signing up during our loyalty program launch!',
      type: 'standard',
      isActive: false,
      startDate: daysAgo(90),
      endDate: daysAgo(60),
      rules: [
        { minSpend: 0, pointsAwarded: 15, multiplier: 1.0, dayOfWeek: null },
      ],
    },
  ];

  const promotions: {
    id: string;
    type: string;
    isActive: boolean;
    startDate: Date;
    endDate: Date;
    rules: { minSpend: number; pointsAwarded: number; multiplier: number; dayOfWeek: string | null }[];
  }[] = [];

  for (const p of promoSeedData) {
    const { rules, ...promoData } = p;
    const promo = await prisma.promotion.create({
      data: {
        ...promoData,
        rules: {
          create: rules.map((r) => ({
            minSpend: r.minSpend,
            pointsAwarded: r.pointsAwarded,
            multiplier: r.multiplier,
            dayOfWeek: r.dayOfWeek,
          })),
        },
      },
    });
    promotions.push({
      id: promo.id,
      type: p.type,
      isActive: p.isActive,
      startDate: p.startDate,
      endDate: p.endDate,
      rules,
    });
    console.log(`   Created: ${promo.name} (${p.type}, active=${p.isActive})`);
  }

  // ── Step 4: Transactions + QR Codes (300) ──────────────────────────────────
  console.log('\n💳 Seeding transactions & QR codes...');

  // Build assignment: which customer gets how many transactions
  const txAssignment: number[] = []; // customer index for each transaction

  // Power users: 15-30 tx each
  for (const idx of powerUserIndices) {
    const count = rand(15, 30);
    for (let i = 0; i < count; i++) txAssignment.push(idx);
  }

  // Regular users: 3-8 tx each
  for (const idx of regularUserIndices) {
    const count = rand(3, 8);
    for (let i = 0; i < count; i++) txAssignment.push(idx);
  }

  // Light users: 1-2 tx each
  for (const idx of lightUserIndices) {
    const count = rand(1, 2);
    for (let i = 0; i < count; i++) txAssignment.push(idx);
  }

  // Inactive users: 0 transactions

  // Shuffle and trim/pad to exactly 300
  for (let i = txAssignment.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [txAssignment[i], txAssignment[j]] = [txAssignment[j], txAssignment[i]];
  }

  while (txAssignment.length > 300) txAssignment.pop();
  while (txAssignment.length < 300) {
    // Add more to random regular users
    txAssignment.push(pick(regularUserIndices));
  }

  // Shuffle again
  for (let i = txAssignment.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [txAssignment[i], txAssignment[j]] = [txAssignment[j], txAssignment[i]];
  }

  // Status distribution: 270 completed, 20 pending, 10 expired
  const statusPool: string[] = [
    ...Array(270).fill('completed'),
    ...Array(20).fill('pending'),
    ...Array(10).fill('expired'),
  ];
  // Shuffle statuses
  for (let i = statusPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [statusPool[i], statusPool[j]] = [statusPool[j], statusPool[i]];
  }

  // Time spread: 60 month-1, 100 month-2, 140 month-3
  const txTimeRanges = [
    { count: 60, startDaysAgo: 90, endDaysAgo: 61 },
    { count: 100, startDaysAgo: 60, endDaysAgo: 31 },
    { count: 140, startDaysAgo: 30, endDaysAgo: 1 },
  ];

  const txDates: Date[] = [];
  for (const range of txTimeRanges) {
    for (let i = 0; i < range.count; i++) {
      txDates.push(daysAgo(rand(range.endDaysAgo, range.startDaysAgo)));
    }
  }
  // Shuffle dates
  for (let i = txDates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [txDates[i], txDates[j]] = [txDates[j], txDates[i]];
  }

  // Track points per customer for recalculation
  const customerPointsEarned: Map<string, number> = new Map();

  const transactionIds: string[] = [];
  const transactionCustomerMap: Map<string, string> = new Map(); // txId -> customerId
  const completedTxDates: Date[] = [];

  for (let i = 0; i < 300; i++) {
    const custIdx = txAssignment[i];
    const customerId = customerIds[custIdx];
    const status = statusPool[i];
    const txDate = txDates[i];

    // Ensure transaction date is after customer signup
    const actualDate = txDate < customerCreatedDates[custIdx]
      ? new Date(customerCreatedDates[custIdx].getTime() + rand(1, 48) * 60 * 60 * 1000)
      : txDate;

    // Generate order items and compute amount
    const items = generateOrderItems();
    const orderAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Calculate points using promotion engine logic (only for completed transactions)
    let pointsEarned = 0;
    let promotionId: string | null = null;

    if (status === 'completed') {
      const result = calculatePointsForSeed(orderAmount, actualDate, promotions);
      pointsEarned = result.pointsEarned;
      promotionId = result.promotionId;

      // Accumulate points
      const prevPoints = customerPointsEarned.get(customerId) || 0;
      customerPointsEarned.set(customerId, prevPoints + pointsEarned);
    }

    const posRef = `POS-${pickWeighted(BRANCHES).replace('-', '')}-${actualDate.getTime()}-${String(i).padStart(4, '0')}`;

    const tx = await prisma.transaction.create({
      data: {
        posTransactionRef: posRef,
        orderAmount: new Prisma.Decimal(orderAmount),
        pointsEarned,
        branchCode: pickWeighted(BRANCHES),
        items: items as unknown as Prisma.InputJsonValue,
        status,
        promotionId,
        customerId,
        createdAt: actualDate,
      },
    });

    transactionIds.push(tx.id);
    transactionCustomerMap.set(tx.id, customerId);
    if (status === 'completed') completedTxDates.push(actualDate);

    // Create corresponding QR code
    const qrExpiresAt = new Date(actualDate.getTime() + 5 * 60 * 1000); // 5 minutes
    await prisma.qrCode.create({
      data: {
        code: `LR-${randomUUID()}`,
        transactionId: tx.id,
        scannedAt: status === 'completed' ? new Date(actualDate.getTime() + rand(30, 240) * 1000) : null,
        expiresAt: qrExpiresAt,
        createdAt: actualDate,
      },
    });
  }
  console.log(`   Created 300 transactions + 300 QR codes.`);

  // ── Step 5: Rewards (6) ────────────────────────────────────────────────────
  console.log('\n🎁 Seeding rewards...');

  const rewardSeedData = [
    {
      name: 'Free Chicken Inasal Paa',
      description: 'Redeem for one free Chicken Inasal Paa (leg quarter), our signature dish!',
      type: 'free_item',
      pointsCost: 10,
      stockLimit: 200,
      isActive: true,
      validFrom: daysAgo(85),
      validUntil: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
      targetRedemptions: 20,
    },
    {
      name: 'Free Iced Tea',
      description: 'Quench your thirst with a free refreshing Iced Tea!',
      type: 'free_item',
      pointsCost: 3,
      stockLimit: null,
      isActive: true,
      validFrom: daysAgo(85),
      validUntil: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
      targetRedemptions: 30,
    },
    {
      name: 'PHP 50 Off',
      description: 'Get PHP 50 off your next order of PHP 300 or more!',
      type: 'discount',
      pointsCost: 5,
      stockLimit: 100,
      isActive: true,
      validFrom: daysAgo(70),
      validUntil: new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000),
      targetRedemptions: 15,
    },
    {
      name: 'Free Halo-Halo',
      description: 'Cool down with our delicious Halo-Halo dessert, on the house!',
      type: 'free_item',
      pointsCost: 7,
      stockLimit: 50,
      isActive: true,
      validFrom: daysAgo(60),
      validUntil: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
      targetRedemptions: 8,
    },
    {
      name: 'PHP 100 Gift Voucher',
      description: 'A PHP 100 gift voucher valid at any Chix Inasal branch.',
      type: 'voucher',
      pointsCost: 15,
      stockLimit: 30,
      isActive: true,
      validFrom: daysAgo(50),
      validUntil: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
      targetRedemptions: 5,
    },
    {
      name: 'Family Feast Voucher',
      description: 'A special voucher for a complete family meal including 4 Chicken Inasal, 4 Rice, and drinks!',
      type: 'voucher',
      pointsCost: 25,
      stockLimit: 20,
      isActive: false,
      validFrom: daysAgo(85),
      validUntil: daysAgo(10),
      targetRedemptions: 2,
    },
  ];

  const rewards: { id: string; pointsCost: number; targetRedemptions: number }[] = [];
  for (const r of rewardSeedData) {
    const { targetRedemptions, ...rewardData } = r;
    const reward = await prisma.reward.create({ data: rewardData });
    rewards.push({ id: reward.id, pointsCost: r.pointsCost, targetRedemptions });
    console.log(`   Created: ${reward.name} (${r.pointsCost} pts, stock=${r.stockLimit ?? '∞'})`);
  }

  // ── Step 6: Redemptions (80) ───────────────────────────────────────────────
  console.log('\n🎟️  Seeding redemptions...');

  // Status distribution: 50 verified, 15 active, 12 expired, 3 cancelled
  const redemptionStatuses: string[] = [
    ...Array(50).fill('verified'),
    ...Array(15).fill('active'),
    ...Array(12).fill('expired'),
    ...Array(3).fill('cancelled'),
  ];
  // Shuffle
  for (let i = redemptionStatuses.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [redemptionStatuses[i], redemptionStatuses[j]] = [redemptionStatuses[j], redemptionStatuses[i]];
  }

  // Build redemption assignments per reward to match target counts
  const redemptionAssignments: { rewardIdx: number; status: string }[] = [];
  let statusIdx = 0;
  for (let ri = 0; ri < rewards.length; ri++) {
    for (let c = 0; c < rewards[ri].targetRedemptions; c++) {
      if (statusIdx < redemptionStatuses.length) {
        redemptionAssignments.push({ rewardIdx: ri, status: redemptionStatuses[statusIdx] });
        statusIdx++;
      }
    }
  }

  // Shuffle assignments
  for (let i = redemptionAssignments.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [redemptionAssignments[i], redemptionAssignments[j]] = [
      redemptionAssignments[j],
      redemptionAssignments[i],
    ];
  }

  // Power users get ~40% of redemptions, rest spread among regular users
  const powerRedemptionCount = Math.floor(redemptionAssignments.length * 0.4);
  const redemptionCustomerIndices: number[] = [];
  for (let i = 0; i < powerRedemptionCount; i++) {
    redemptionCustomerIndices.push(pick(powerUserIndices));
  }
  for (let i = powerRedemptionCount; i < redemptionAssignments.length; i++) {
    redemptionCustomerIndices.push(pick(regularUserIndices));
  }
  // Shuffle customer assignments
  for (let i = redemptionCustomerIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [redemptionCustomerIndices[i], redemptionCustomerIndices[j]] = [
      redemptionCustomerIndices[j],
      redemptionCustomerIndices[i],
    ];
  }

  const customerPointsSpent: Map<string, number> = new Map();
  const rewardStockUsed: Map<string, number> = new Map();
  const usedRedemptionCodes = new Set<string>();

  for (let i = 0; i < redemptionAssignments.length; i++) {
    const { rewardIdx, status } = redemptionAssignments[i];
    const reward = rewards[rewardIdx];
    const custIdx = redemptionCustomerIndices[i];
    const customerId = customerIds[custIdx];

    const redeemedAt = daysAgo(rand(2, 75));
    const expiresAt = new Date(redeemedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const verifiedAt =
      status === 'verified'
        ? new Date(redeemedAt.getTime() + rand(1, 48) * 60 * 60 * 1000)
        : null;

    // Generate unique redemption code
    let redemptionCode: string;
    do {
      redemptionCode = generateRedemptionCode();
    } while (usedRedemptionCodes.has(redemptionCode));
    usedRedemptionCodes.add(redemptionCode);

    await prisma.redemption.create({
      data: {
        customerId,
        rewardId: reward.id,
        pointsSpent: reward.pointsCost,
        redemptionCode,
        status,
        redeemedAt,
        verifiedAt,
        expiresAt,
        createdAt: redeemedAt,
      },
    });

    // Track points spent (non-cancelled redemptions)
    if (status !== 'cancelled') {
      const prev = customerPointsSpent.get(customerId) || 0;
      customerPointsSpent.set(customerId, prev + reward.pointsCost);
    }

    // Track stock used (non-cancelled)
    if (status !== 'cancelled') {
      const prev = rewardStockUsed.get(reward.id) || 0;
      rewardStockUsed.set(reward.id, prev + 1);
    }
  }
  console.log(`   Created ${redemptionAssignments.length} redemptions.`);

  // ── Step 7: OTP Codes (8) ─────────────────────────────────────────────────
  console.log('\n🔑 Seeding OTP codes...');

  const otpCustomerPhones: string[] = [];
  // Grab phones from first 8 customers
  const first8Customers = await prisma.customer.findMany({
    take: 8,
    orderBy: { createdAt: 'asc' },
    select: { phoneNumber: true },
  });
  for (const c of first8Customers) {
    otpCustomerPhones.push(c.phoneNumber);
  }

  for (let i = 0; i < 8; i++) {
    const isExpired = i < 5; // 5 expired, 3 fresh
    const createdAt = isExpired ? daysAgo(rand(5, 30)) : daysAgo(0);
    const expiresAt = isExpired
      ? new Date(createdAt.getTime() + 5 * 60 * 1000)
      : new Date(now.getTime() + 5 * 60 * 1000);

    await prisma.otpCode.create({
      data: {
        phoneNumber: otpCustomerPhones[i],
        code: String(rand(100000, 999999)),
        attempts: isExpired ? rand(0, 3) : 0,
        expiresAt,
        createdAt,
      },
    });
  }
  console.log(`   Created 8 OTP codes.`);

  // ── Step 8: Audit Logs (20) ────────────────────────────────────────────────
  console.log('\n📋 Seeding audit logs...');

  const auditActions: { action: string; entity: string; entityId: string; details: object }[] = [];

  // Promotion-related audit logs
  for (const promo of promotions) {
    auditActions.push({
      action: 'create',
      entity: 'promotion',
      entityId: promo.id,
      details: { name: promoSeedData.find((p) => p.type === promo.type)?.name },
    });
  }

  // Some promotion updates
  auditActions.push({
    action: 'update',
    entity: 'promotion',
    entityId: promotions[2].id, // Grand Opening expired
    details: { field: 'isActive', oldValue: true, newValue: false },
  });
  auditActions.push({
    action: 'update',
    entity: 'promotion',
    entityId: promotions[4].id, // Loyalty Launch expired
    details: { field: 'isActive', oldValue: true, newValue: false },
  });

  // Reward-related audit logs
  for (const reward of rewards) {
    auditActions.push({
      action: 'create',
      entity: 'reward',
      entityId: reward.id,
      details: { pointsCost: reward.pointsCost },
    });
  }

  // Redemption verification audit logs
  const verifiedRedemptions = await prisma.redemption.findMany({
    where: { status: 'verified' },
    take: 7,
    select: { id: true },
  });
  for (const rd of verifiedRedemptions) {
    auditActions.push({
      action: 'verify',
      entity: 'redemption',
      entityId: rd.id,
      details: { status: 'verified' },
    });
  }

  // Trim to 20 and shuffle
  const trimmedAudits = auditActions.slice(0, 20);
  for (let i = trimmedAudits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [trimmedAudits[i], trimmedAudits[j]] = [trimmedAudits[j], trimmedAudits[i]];
  }

  for (const audit of trimmedAudits) {
    await prisma.auditLog.create({
      data: {
        adminUserId: pick(admins).id,
        action: audit.action,
        entity: audit.entity,
        entityId: audit.entityId,
        details: audit.details as Prisma.InputJsonValue,
        createdAt: daysAgo(rand(1, 85)),
      },
    });
  }
  console.log(`   Created ${trimmedAudits.length} audit logs.`);

  // ── Step 9: Recalculate Customer Points ────────────────────────────────────
  console.log('\n🔄 Recalculating customer points...');

  for (const customerId of customerIds) {
    const totalPoints = customerPointsEarned.get(customerId) || 0;
    const pointsSpent = customerPointsSpent.get(customerId) || 0;
    const availablePoints = Math.max(0, totalPoints - pointsSpent);

    await prisma.customer.update({
      where: { id: customerId },
      data: { totalPoints, availablePoints },
    });
  }
  console.log('   Done.');

  // ── Step 10: Update Reward Stock Used ──────────────────────────────────────
  console.log('\n📦 Updating reward stock used...');

  for (const reward of rewards) {
    const used = rewardStockUsed.get(reward.id) || 0;
    await prisma.reward.update({
      where: { id: reward.id },
      data: { stockUsed: used },
    });
  }
  console.log('   Done.');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete! Summary:');
  console.log(`   Admin Users:   ${admins.length}`);
  console.log(`   Customers:     ${customerIds.length}`);
  console.log(`   Promotions:    ${promotions.length}`);
  console.log(`   Transactions:  300`);
  console.log(`   QR Codes:      300`);
  console.log(`   Rewards:       ${rewards.length}`);
  console.log(`   Redemptions:   ${redemptionAssignments.length}`);
  console.log(`   OTP Codes:     8`);
  console.log(`   Audit Logs:    ${trimmedAudits.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
