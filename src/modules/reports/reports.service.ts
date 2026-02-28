import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private getDateRange(dateFrom?: string, dateTo?: string, defaultDays = 30) {
    const to = dateTo ? new Date(dateTo + 'T23:59:59.999Z') : new Date();
    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(to.getTime() - defaultDays * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  async getDashboard(dateFrom?: string, dateTo?: string) {
    const { from, to } = this.getDateRange(dateFrom, dateTo);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalCustomers,
      newCustomersThisMonth,
      customersLastMonth,
      pointsAgg,
      totalTransactions,
      transactionsThisPeriod,
      totalRedemptions,
      redemptionsThisPeriod,
      orderAvg,
      topRewards,
      transactionsToday,
      redemptionsToday,
      pointsTodayAgg,
      newCustomersToday,
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.customer.count({
        where: {
          createdAt: { gte: startOfLastMonth, lt: startOfMonth },
        },
      }),
      this.prisma.customer.aggregate({
        _sum: { totalPoints: true, availablePoints: true },
      }),
      this.prisma.transaction.count({ where: { status: 'completed' } }),
      this.prisma.transaction.count({
        where: { status: 'completed', createdAt: { gte: from, lte: to } },
      }),
      this.prisma.redemption.count(),
      this.prisma.redemption.count({
        where: { createdAt: { gte: from, lte: to } },
      }),
      this.prisma.transaction.aggregate({
        _avg: { orderAmount: true },
        where: { status: 'completed' },
      }),
      this.prisma.redemption.groupBy({
        by: ['rewardId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      this.prisma.transaction.count({
        where: { status: 'completed', createdAt: { gte: startOfToday } },
      }),
      this.prisma.redemption.count({
        where: { createdAt: { gte: startOfToday } },
      }),
      this.prisma.transaction.aggregate({
        _sum: { pointsEarned: true },
        where: { status: 'completed', createdAt: { gte: startOfToday } },
      }),
      this.prisma.customer.count({
        where: { createdAt: { gte: startOfToday } },
      }),
    ]);

    // Resolve top reward names
    const rewardIds = topRewards.map((r) => r.rewardId);
    const rewards = rewardIds.length
      ? await this.prisma.reward.findMany({
          where: { id: { in: rewardIds } },
          select: { id: true, name: true },
        })
      : [];
    const rewardMap = new Map(rewards.map((r) => [r.id, r.name]));

    const totalPointsIssued = pointsAgg._sum.totalPoints || 0;
    const pointsInCirculation = pointsAgg._sum.availablePoints || 0;
    const totalPointsRedeemed = totalPointsIssued - pointsInCirculation;

    const customerGrowthPercent = customersLastMonth > 0
      ? Number(((newCustomersThisMonth - customersLastMonth) / customersLastMonth * 100).toFixed(1))
      : newCustomersThisMonth > 0 ? 100 : 0;

    return {
      totalCustomers,
      newCustomersThisMonth,
      customerGrowthPercent,
      totalPointsIssued,
      totalPointsRedeemed,
      pointsInCirculation,
      totalTransactions,
      transactionsThisPeriod,
      totalRedemptions,
      redemptionsThisPeriod,
      averageOrderAmount: Number(orderAvg._avg.orderAmount || 0),
      topRewards: topRewards.map((r) => ({
        id: r.rewardId,
        name: rewardMap.get(r.rewardId) || 'Unknown',
        redemptions: r._count.id,
      })),
      recentActivity: {
        transactionsToday,
        redemptionsToday,
        pointsIssuedToday: pointsTodayAgg._sum.pointsEarned || 0,
        newCustomersToday,
      },
    };
  }

  async getPromotionStats(dateFrom?: string, dateTo?: string) {
    const { from, to } = this.getDateRange(dateFrom, dateTo);

    const promotions = await this.prisma.promotion.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        startDate: true,
        endDate: true,
      },
    });

    const stats = await Promise.all(
      promotions.map(async (promo) => {
        const where = {
          promotionId: promo.id,
          status: 'completed' as const,
          createdAt: { gte: from, lte: to },
        };

        const [txAgg, uniqueCustomers] = await Promise.all([
          this.prisma.transaction.aggregate({
            _count: { id: true },
            _sum: { pointsEarned: true },
            _avg: { orderAmount: true },
            where,
          }),
          this.prisma.transaction.groupBy({
            by: ['customerId'],
            where: { ...where, customerId: { not: null } },
          }),
        ]);

        return {
          id: promo.id,
          name: promo.name,
          type: promo.type,
          isActive: promo.isActive,
          startDate: promo.startDate,
          endDate: promo.endDate,
          totalTransactions: txAgg._count.id,
          totalPointsIssued: txAgg._sum.pointsEarned || 0,
          averageOrderAmount: Number(txAgg._avg.orderAmount || 0),
          uniqueCustomers: uniqueCustomers.length,
        };
      }),
    );

    return stats;
  }

  async getRewardStats() {
    const rewards = await this.prisma.reward.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        pointsCost: true,
        stockLimit: true,
        stockUsed: true,
      },
    });

    const stats = await Promise.all(
      rewards.map(async (reward) => {
        const statusCounts = await this.prisma.redemption.groupBy({
          by: ['status'],
          where: { rewardId: reward.id },
          _count: { id: true },
          _sum: { pointsSpent: true },
        });

        const counts: Record<string, number> = {};
        let totalPointsSpent = 0;
        let totalRedemptions = 0;

        for (const sc of statusCounts) {
          counts[sc.status] = sc._count.id;
          totalRedemptions += sc._count.id;
          totalPointsSpent += sc._sum.pointsSpent || 0;
        }

        return {
          id: reward.id,
          name: reward.name,
          type: reward.type,
          pointsCost: reward.pointsCost,
          totalRedemptions,
          verifiedRedemptions: counts['verified'] || 0,
          pendingRedemptions: counts['active'] || 0,
          expiredRedemptions: counts['expired'] || 0,
          stockLimit: reward.stockLimit,
          stockUsed: reward.stockUsed,
          stockRemaining: reward.stockLimit
            ? reward.stockLimit - reward.stockUsed
            : null,
          totalPointsSpent,
        };
      }),
    );

    return stats;
  }

  async getBranchStats(dateFrom?: string, dateTo?: string) {
    const { from, to } = this.getDateRange(dateFrom, dateTo);

    const branches = await this.prisma.$queryRaw<
      Array<{
        branchCode: string;
        transactionCount: bigint;
        totalRevenue: number;
        totalPoints: bigint;
        averageOrderAmount: number;
      }>
    >`
      SELECT
        branch_code AS branchCode,
        COUNT(*) AS transactionCount,
        CAST(SUM(order_amount) AS DOUBLE) AS totalRevenue,
        COALESCE(SUM(points_earned), 0) AS totalPoints,
        CAST(AVG(order_amount) AS DOUBLE) AS averageOrderAmount
      FROM transactions
      WHERE status = 'completed'
        AND branch_code IS NOT NULL
        AND created_at >= ${from}
        AND created_at <= ${to}
      GROUP BY branch_code
      ORDER BY transactionCount DESC
      LIMIT 10
    `;

    return branches.map((b) => ({
      branchCode: b.branchCode,
      transactionCount: Number(b.transactionCount),
      totalRevenue: Number(b.totalRevenue || 0),
      totalPoints: Number(b.totalPoints || 0),
      averageOrderAmount: Number(b.averageOrderAmount || 0),
    }));
  }

  async getCustomerGrowth(
    dateFrom?: string,
    dateTo?: string,
    interval: 'day' | 'week' | 'month' = 'day',
  ) {
    const { from, to } = this.getDateRange(dateFrom, dateTo, 90);

    // Summary
    const [totalCustomers, totalPointsSum] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.customer.aggregate({
        _avg: { totalPoints: true },
      }),
    ]);

    // Active = has at least one completed transaction in the period
    const activeCustomerRows = await this.prisma.transaction.groupBy({
      by: ['customerId'],
      where: {
        status: 'completed',
        createdAt: { gte: from, lte: to },
        customerId: { not: null },
      },
    });
    const activeCustomers = activeCustomerRows.length;
    const inactiveCustomers = totalCustomers - activeCustomers;

    // Timeline via raw query for date grouping
    const dateFormat =
      interval === 'month'
        ? '%Y-%m-01'
        : interval === 'week'
          ? '%x-%v' // ISO year-week
          : '%Y-%m-%d';

    const timeline = await this.prisma.$queryRaw<
      Array<{
        date: string;
        newCustomers: bigint;
        transactions: bigint;
        pointsIssued: bigint | null;
      }>
    >`
      SELECT
        DATE_FORMAT(dates.d, ${dateFormat}) AS date,
        COALESCE(nc.cnt, 0) AS newCustomers,
        COALESCE(tx.cnt, 0) AS transactions,
        COALESCE(tx.pts, 0) AS pointsIssued
      FROM (
        SELECT DISTINCT DATE_FORMAT(created_at, ${dateFormat}) AS d
        FROM customers
        WHERE created_at >= ${from} AND created_at <= ${to}
        UNION
        SELECT DISTINCT DATE_FORMAT(created_at, ${dateFormat}) AS d
        FROM transactions
        WHERE created_at >= ${from} AND created_at <= ${to}
      ) dates
      LEFT JOIN (
        SELECT DATE_FORMAT(created_at, ${dateFormat}) AS d, COUNT(*) AS cnt
        FROM customers
        WHERE created_at >= ${from} AND created_at <= ${to}
        GROUP BY d
      ) nc ON nc.d = dates.d
      LEFT JOIN (
        SELECT DATE_FORMAT(created_at, ${dateFormat}) AS d, COUNT(*) AS cnt, SUM(points_earned) AS pts
        FROM transactions
        WHERE status = 'completed' AND created_at >= ${from} AND created_at <= ${to}
        GROUP BY d
      ) tx ON tx.d = dates.d
      ORDER BY date ASC
    `;

    // Count active customers per period — simplified: use unique customers from transactions
    const activePerPeriod = await this.prisma.$queryRaw<
      Array<{ date: string; activeCustomers: bigint }>
    >`
      SELECT
        DATE_FORMAT(created_at, ${dateFormat}) AS date,
        COUNT(DISTINCT customer_id) AS activeCustomers
      FROM transactions
      WHERE status = 'completed'
        AND customer_id IS NOT NULL
        AND created_at >= ${from}
        AND created_at <= ${to}
      GROUP BY date
      ORDER BY date ASC
    `;

    const activeMap = new Map(
      activePerPeriod.map((r) => [r.date, Number(r.activeCustomers)]),
    );

    return {
      summary: {
        totalCustomers,
        activeCustomers,
        inactiveCustomers,
        averagePointsPerCustomer: Math.round(
          Number(totalPointsSum._avg.totalPoints || 0),
        ),
      },
      timeline: timeline.map((row) => ({
        date: row.date,
        newCustomers: Number(row.newCustomers),
        activeCustomers: activeMap.get(row.date) || 0,
        transactions: Number(row.transactions),
        pointsIssued: Number(row.pointsIssued || 0),
      })),
    };
  }
}
