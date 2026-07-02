import { prisma } from '../../lib/prisma.js';

export const adminDashboardService = {
  async getStats() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersLast7Days,
      newUsersLast30Days,
      professionalCount,
      premiumCount,
      totalResumes,
      totalTemplatePurchases,
      pointsSum,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { subscriptionTier: 'PROFESSIONAL' } }),
      prisma.user.count({ where: { subscriptionTier: 'PREMIUM' } }),
      prisma.resume.count(),
      prisma.templatePurchase.count(),
      prisma.user.aggregate({ _sum: { pointsBalance: true } }),
    ]);

    return {
      totalUsers,
      newUsersLast7Days,
      newUsersLast30Days,
      activeSubscriptions: {
        PROFESSIONAL: professionalCount,
        PREMIUM: premiumCount,
      },
      totalResumes,
      totalTemplatePurchases,
      pointsInCirculation: pointsSum._sum.pointsBalance ?? 0,
    };
  },
};
