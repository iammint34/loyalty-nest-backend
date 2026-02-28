import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import { RewardQueryDto } from './dto/reward-query.dto';

@Injectable()
export class RewardsService {
  private readonly logger = new Logger(RewardsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRewardDto) {
    const reward = await this.prisma.reward.create({
      data: {
        ...dto,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
      },
    });
    this.logger.log(`Reward created: "${reward.name}" (${reward.id})`);
    return reward;
  }

  async findAll(query: RewardQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.type) where.type = query.type;

    const [data, total] = await Promise.all([
      this.prisma.reward.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: {
          _count: { select: { redemptions: true } },
        },
      }),
      this.prisma.reward.count({ where }),
    ]);

    return {
      data: data.map(({ _count, ...reward }) => ({
        ...reward,
        stockRemaining: reward.stockLimit
          ? reward.stockLimit - reward.stockUsed
          : null,
        totalRedemptions: _count.redemptions,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const reward = await this.prisma.reward.findUnique({
      where: { id },
      include: {
        _count: { select: { redemptions: true } },
      },
    });
    if (!reward) {
      throw new NotFoundException('Reward not found');
    }
    const { _count, ...rest } = reward;
    return {
      ...rest,
      stockRemaining: rest.stockLimit ? rest.stockLimit - rest.stockUsed : null,
      totalRedemptions: _count.redemptions,
    };
  }

  async update(id: string, dto: UpdateRewardDto) {
    await this.findOne(id);

    const updateData: Record<string, unknown> = { ...dto };
    if (dto.validFrom) updateData.validFrom = new Date(dto.validFrom);
    if (dto.validUntil) updateData.validUntil = new Date(dto.validUntil);

    const result = await this.prisma.reward.update({
      where: { id },
      data: updateData,
    });
    this.logger.log(`Reward updated: "${result.name}" (${id})`);
    return result;
  }

  async remove(id: string) {
    await this.findOne(id);
    this.logger.log(`Reward deactivated: ${id}`);
    return this.prisma.reward.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findAvailable() {
    const now = new Date();
    const rewards = await this.prisma.reward.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      orderBy: { pointsCost: 'asc' },
    });

    return rewards
      .filter((r) => !r.stockLimit || r.stockUsed < r.stockLimit)
      .map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        type: r.type,
        pointsCost: r.pointsCost,
        stockRemaining: r.stockLimit ? r.stockLimit - r.stockUsed : null,
        validUntil: r.validUntil,
      }));
  }
}
