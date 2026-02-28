import {
  Injectable,
  NotFoundException,
  ConflictException,
  GoneException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import { calculatePoints } from '../promotions/promotions.engine';

@Injectable()
export class QrCodesService {
  private readonly logger = new Logger(QrCodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly promotionsService: PromotionsService,
  ) {}

  async scan(code: string, customerId: string) {
    const qrCode = await this.prisma.qrCode.findUnique({
      where: { code },
      include: { transaction: true },
    });

    if (!qrCode) {
      throw new NotFoundException('QR code not found');
    }

    if (qrCode.scannedAt) {
      throw new ConflictException('QR code has already been scanned');
    }

    if (new Date() > qrCode.expiresAt) {
      throw new GoneException('QR code has expired');
    }

    const orderAmount = Number(qrCode.transaction.orderAmount);
    const activePromotions = await this.promotionsService.findActiveWithRules();
    const { pointsEarned, promotionId, promotionName } = calculatePoints(
      orderAmount,
      activePromotions.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        rules: p.rules,
      })),
    );

    const [transaction] = await this.prisma.$transaction([
      this.prisma.transaction.update({
        where: { id: qrCode.transactionId },
        data: {
          customerId,
          pointsEarned,
          promotionId,
          status: 'completed',
        },
      }),
      this.prisma.qrCode.update({
        where: { id: qrCode.id },
        data: { scannedAt: new Date() },
      }),
      this.prisma.customer.update({
        where: { id: customerId },
        data: {
          totalPoints: { increment: pointsEarned },
          availablePoints: { increment: pointsEarned },
        },
      }),
    ]);

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    this.logger.log(
      `QR scan: code=${code} customer=${customerId} points=${pointsEarned}${promotionName ? ` promotion="${promotionName}"` : ''}`,
    );

    return {
      transactionId: transaction.id,
      orderAmount,
      pointsEarned,
      promotionId,
      promotionName,
      totalPoints: customer!.totalPoints,
      availablePoints: customer!.availablePoints,
    };
  }

  async findOne(id: string) {
    const qrCode = await this.prisma.qrCode.findUnique({
      where: { id },
      include: { transaction: true },
    });
    if (!qrCode) {
      throw new NotFoundException('QR code not found');
    }
    return qrCode;
  }
}
