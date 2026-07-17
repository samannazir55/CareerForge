import { prisma } from '../../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { pointsService } from '../points/points.service.js';
import { notify } from '../../lib/notify.js';
import { emailProvider } from '../providers/email/index.js';
import { recordAuditLog } from '../admin/auditLog.js';
import type {
  CreatePromoCodeRequest,
  UpdatePromoCodeRequest,
  SendPromoCampaignRequest,
  SendPromoCampaignResponse,
} from '@careerforge/schema';

function serialize(row: {
  id: string;
  code: string;
  pointsValue: number;
  description: string | null;
  maxRedemptions: number | null;
  perUserLimit: number;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { redemptions: number };
}) {
  return {
    id: row.id,
    code: row.code,
    pointsValue: row.pointsValue,
    description: row.description,
    maxRedemptions: row.maxRedemptions,
    perUserLimit: row.perUserLimit,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    isActive: row.isActive,
    redemptionCount: row._count?.redemptions ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const promoCodeService = {
  // -------------------------------------------------------------------
  // Admin management
  // -------------------------------------------------------------------

  async list() {
    const rows = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    });
    return rows.map(serialize);
  },

  async create(adminId: string, input: CreatePromoCodeRequest) {
    const code = input.code.trim().toUpperCase();

    const existing = await prisma.promoCode.findUnique({ where: { code } });
    if (existing) throw new BadRequestError(`Code "${code}" already exists.`, 'CODE_EXISTS');

    const created = await prisma.promoCode.create({
      data: {
        code,
        pointsValue: input.pointsValue,
        description: input.description,
        maxRedemptions: input.maxRedemptions,
        perUserLimit: input.perUserLimit,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        isActive: input.isActive,
        createdBy: adminId,
      },
      include: { _count: { select: { redemptions: true } } },
    });

    await recordAuditLog(adminId, 'PROMO_CODE_CREATE', 'PromoCode', created.id, {
      code: created.code,
      pointsValue: created.pointsValue,
    });

    return serialize(created);
  },

  async update(adminId: string, id: string, input: UpdatePromoCodeRequest) {
    const existing = await prisma.promoCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Promo code not found.');

    let code = existing.code;
    if (input.code) {
      code = input.code.trim().toUpperCase();
      if (code !== existing.code) {
        const dup = await prisma.promoCode.findUnique({ where: { code } });
        if (dup) throw new BadRequestError(`Code "${code}" already exists.`, 'CODE_EXISTS');
      }
    }

    const updated = await prisma.promoCode.update({
      where: { id },
      data: {
        code,
        pointsValue: input.pointsValue,
        description: input.description,
        maxRedemptions: input.maxRedemptions,
        perUserLimit: input.perUserLimit,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : input.expiresAt === undefined ? undefined : null,
        isActive: input.isActive,
      },
      include: { _count: { select: { redemptions: true } } },
    });

    await recordAuditLog(adminId, 'PROMO_CODE_UPDATE', 'PromoCode', updated.id, { changes: input });

    return serialize(updated);
  },

  async deactivate(adminId: string, id: string) {
    const existing = await prisma.promoCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Promo code not found.');

    await prisma.promoCode.update({ where: { id }, data: { isActive: false } });
    await recordAuditLog(adminId, 'PROMO_CODE_DEACTIVATE', 'PromoCode', id, { code: existing.code });
  },

  // -------------------------------------------------------------------
  // User redemption
  // -------------------------------------------------------------------

  async redeem(userId: string, rawCode: string): Promise<{ pointsAwarded: number; newBalance: number }> {
    const code = rawCode.trim().toUpperCase();
    const promo = await prisma.promoCode.findUnique({ where: { code } });

    if (!promo || !promo.isActive) {
      throw new BadRequestError('Invalid or inactive promo code.', 'INVALID_CODE');
    }
    if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
      throw new BadRequestError('This promo code has expired.', 'CODE_EXPIRED');
    }

    // Enforce per-user and global caps by counting existing redemption rows
    // rather than a mutable counter column — the redemption log is the
    // source of truth, same reasoning as the points ledger.
    const [userRedemptions, totalRedemptions] = await Promise.all([
      prisma.promoCodeRedemption.count({ where: { promoCodeId: promo.id, userId } }),
      promo.maxRedemptions !== null
        ? prisma.promoCodeRedemption.count({ where: { promoCodeId: promo.id } })
        : Promise.resolve(0),
    ]);

    if (userRedemptions >= promo.perUserLimit) {
      throw new BadRequestError('You have already redeemed this code.', 'ALREADY_REDEEMED');
    }
    if (promo.maxRedemptions !== null && totalRedemptions >= promo.maxRedemptions) {
      throw new BadRequestError('This promo code has reached its redemption limit.', 'CODE_EXHAUSTED');
    }

    await prisma.promoCodeRedemption.create({ data: { promoCodeId: promo.id, userId } });
    await pointsService.award(
      userId,
      promo.pointsValue,
      'PROMO_CODE',
      promo.description ?? `Promo code: ${promo.code}`,
    );

    const newBalance = await pointsService.getBalance(userId);
    return { pointsAwarded: promo.pointsValue, newBalance };
  },

  // -------------------------------------------------------------------
  // Campaign broadcast — email + in-dashboard notification to a segment
  // -------------------------------------------------------------------

  async sendCampaign(
    adminId: string,
    promoCodeId: string,
    input: SendPromoCampaignRequest,
  ): Promise<SendPromoCampaignResponse> {
    const promo = await prisma.promoCode.findUnique({ where: { id: promoCodeId } });
    if (!promo) throw new NotFoundError('Promo code not found.');

    const where = input.audience === 'ALL' ? {} : { subscriptionTier: input.audience };
    const recipients = await prisma.user.findMany({
      where: { ...where, isEmailVerified: true },
      select: { id: true, email: true, fullName: true },
    });

    let emailsSent = 0;
    let emailsFailed = 0;

    // Sequential rather than Promise.all — this can be a few thousand
    // recipients and the Resend adapter has no batching of its own; a
    // tight concurrent burst would just trip its rate limiter and turn
    // into a wall of retried failures instead of a clean sequential send.
    for (const user of recipients) {
      try {
        await emailProvider.sendPromoCodeEmail({
          to: user.email,
          fullName: user.fullName,
          subject: input.subject,
          message: input.message,
          code: promo.code,
          pointsValue: promo.pointsValue,
          expiresAt: promo.expiresAt ? promo.expiresAt.toISOString() : null,
        });
        emailsSent += 1;
      } catch (err) {
        emailsFailed += 1;
        console.error(`[promoCampaign] failed to email ${user.email}:`, err);
      }

      // In-dashboard notification is best-effort and independent of email
      // delivery — notify() already swallows its own errors.
      await notify(
        user.id,
        'promo_code',
        input.subject,
        input.message,
        { promoCodeId: promo.id, code: promo.code, pointsValue: promo.pointsValue },
      );
    }

    await recordAuditLog(adminId, 'PROMO_CODE_CAMPAIGN_SEND', 'PromoCode', promo.id, {
      audience: input.audience,
      recipientCount: recipients.length,
      emailsSent,
      emailsFailed,
    });

    return { recipientCount: recipients.length, emailsSent, emailsFailed };
  },
};
