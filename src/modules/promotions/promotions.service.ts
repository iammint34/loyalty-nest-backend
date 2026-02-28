import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { PromotionQueryDto } from './dto/promotion-query.dto';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePromotionDto) {
    const { rules, ...promotionData } = dto;
    const promotion = await this.prisma.promotion.create({
      data: {
        ...promotionData,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        rules: {
          create: rules,
        },
      },
      include: { rules: true },
    });
    this.logger.log(`Promotion created: "${promotion.name}" (${promotion.id})`);
    return promotion;
  }

  async findAll(query: PromotionQueryDto) {
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
      this.prisma.promotion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: {
          _count: { select: { rules: true } },
        },
      }),
      this.prisma.promotion.count({ where }),
    ]);

    return {
      data: data.map(({ _count, ...promo }) => ({
        ...promo,
        rulesCount: _count.rules,
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
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      include: { rules: true },
    });
    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }
    return promotion;
  }

  async update(id: string, dto: UpdatePromotionDto) {
    await this.findOne(id);

    const { rules, ...updateData } = dto;

    if (updateData.startDate)
      updateData.startDate = new Date(
        updateData.startDate,
      ) as unknown as string;
    if (updateData.endDate)
      updateData.endDate = new Date(updateData.endDate) as unknown as string;

    if (rules) {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.promotionRule.deleteMany({ where: { promotionId: id } });
        return tx.promotion.update({
          where: { id },
          data: {
            ...updateData,
            rules: { create: rules },
          },
          include: { rules: true },
        });
      });
      this.logger.log(`Promotion updated: "${result.name}" (${id})`);
      return result;
    }

    const result = await this.prisma.promotion.update({
      where: { id },
      data: updateData,
      include: { rules: true },
    });
    this.logger.log(`Promotion updated: "${result.name}" (${id})`);
    return result;
  }

  async remove(id: string) {
    await this.findOne(id);
    this.logger.log(`Promotion deactivated: ${id}`);
    return this.prisma.promotion.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findActive() {
    const now = new Date();
    return this.prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        startDate: true,
        endDate: true,
      },
    });
  }

  async findActiveWithRules() {
    const now = new Date();
    return this.prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: { rules: true },
    });
  }
}
