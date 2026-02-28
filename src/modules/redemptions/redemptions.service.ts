import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRedemptionDto } from './dto/create-redemption.dto';
import { RedemptionQueryDto } from './dto/redemption-query.dto';

const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class RedemptionsService {
  private readonly logger = new Logger(RedemptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private generateRedemptionCode(): string {
    let code = 'RDM-';
    for (let i = 0; i < 6; i++) {
      code += SAFE_CHARS.charAt(Math.floor(Math.random() * SAFE_CHARS.length));
    }
    return code;
  }

  async create(customerId: string, dto: CreateRedemptionDto) {
    const reward = await this.prisma.reward.findUnique({
      where: { id: dto.rewardId },
    });

    if (!reward) {
      throw new NotFoundException('Reward not found');
    }

    const now = new Date();
    if (!reward.isActive) {
      throw new BadRequestException('Reward is not active');
    }
    if (now < reward.validFrom || now > reward.validUntil) {
      throw new BadRequestException(
        'Reward is not within its valid date range',
      );
    }
    if (reward.stockLimit && reward.stockUsed >= reward.stockLimit) {
      throw new BadRequestException('Reward is out of stock');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.availablePoints < reward.pointsCost) {
      throw new BadRequestException(
        `Insufficient points. You have ${customer.availablePoints} but need ${reward.pointsCost}`,
      );
    }

    // Retry loop for code collision
    for (let attempt = 0; attempt < 5; attempt++) {
      const redemptionCode = this.generateRedemptionCode();

      try {
        const redemption = await this.prisma.$transaction(async (tx) => {
          const created = await tx.redemption.create({
            data: {
              customerId,
              rewardId: dto.rewardId,
              pointsSpent: reward.pointsCost,
              redemptionCode,
              status: 'active',
              expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
            },
            include: { reward: true },
          });

          await tx.customer.update({
            where: { id: customerId },
            data: {
              availablePoints: { decrement: reward.pointsCost },
            },
          });

          await tx.reward.update({
            where: { id: dto.rewardId },
            data: {
              stockUsed: { increment: 1 },
            },
          });

          return created;
        });

        const updatedCustomer = await this.prisma.customer.findUnique({
          where: { id: customerId },
        });

        this.logger.log(
          `Redemption created: code=${redemptionCode} customer=${customerId} reward=${dto.rewardId} points=${reward.pointsCost}`,
        );

        return {
          ...redemption,
          customer: {
            availablePoints: updatedCustomer!.availablePoints,
            totalPoints: updatedCustomer!.totalPoints,
          },
        };
      } catch (error: unknown) {
        // Prisma unique constraint violation = P2002
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code: string }).code === 'P2002' &&
          attempt < 4
        ) {
          this.logger.warn(
            `Redemption code collision on "${redemptionCode}", retrying (attempt ${attempt + 1})`,
          );
          continue;
        }
        throw error;
      }
    }

    throw new BadRequestException('Failed to generate unique redemption code');
  }

  async findAll(query: RedemptionQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
        ...(query.dateTo && { lte: new Date(query.dateTo) }),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.redemption.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: {
          customer: {
            select: {
              id: true,
              phoneNumber: true,
              firstName: true,
              lastName: true,
            },
          },
          reward: {
            select: { id: true, name: true, type: true, pointsCost: true },
          },
        },
      }),
      this.prisma.redemption.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findMyRedemptions(customerId: string, query: RedemptionQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { customerId };
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.redemption.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: {
          reward: {
            select: { id: true, name: true, type: true, pointsCost: true },
          },
        },
      }),
      this.prisma.redemption.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const redemption = await this.prisma.redemption.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            phoneNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        reward: true,
      },
    });
    if (!redemption) {
      throw new NotFoundException('Redemption not found');
    }
    return redemption;
  }

  async verify(id: string) {
    const redemption = await this.findOne(id);

    if (redemption.status !== 'active') {
      throw new BadRequestException(
        `Cannot verify redemption with status "${redemption.status}"`,
      );
    }

    if (new Date() > redemption.expiresAt) {
      await this.prisma.redemption.update({
        where: { id },
        data: { status: 'expired' },
      });
      throw new BadRequestException('Redemption has expired');
    }

    this.logger.log(`Redemption verified: ${id}`);

    return this.prisma.redemption.update({
      where: { id },
      data: {
        status: 'verified',
        verifiedAt: new Date(),
      },
      include: {
        customer: {
          select: {
            id: true,
            phoneNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        reward: true,
      },
    });
  }
}
