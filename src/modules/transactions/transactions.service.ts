import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { QR_CODE_EXPIRY_MINUTES } from '../../common/constants';
import { randomUUID } from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTransactionDto) {
    const existing = await this.prisma.transaction.findUnique({
      where: { posTransactionRef: dto.posTransactionRef },
    });
    if (existing) {
      throw new ConflictException(
        `Transaction with POS ref ${dto.posTransactionRef} already exists`,
      );
    }

    const qrCodeString = `LR-${randomUUID()}`;
    const expiresAt = new Date(Date.now() + QR_CODE_EXPIRY_MINUTES * 60 * 1000);

    const transaction = await this.prisma.transaction.create({
      data: {
        posTransactionRef: dto.posTransactionRef,
        orderAmount: dto.orderAmount,
        branchCode: dto.branchCode,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        items: dto.items ? JSON.parse(JSON.stringify(dto.items)) : undefined,
        qrCode: {
          create: {
            code: qrCodeString,
            expiresAt,
          },
        },
      },
      include: { qrCode: true },
    });

    const qrImage = await QRCode.toDataURL(qrCodeString, { width: 300 });

    this.logger.log(
      `Transaction created: posRef=${dto.posTransactionRef} branch=${dto.branchCode} amount=${dto.orderAmount}`,
    );

    return {
      ...transaction,
      orderAmount: Number(transaction.orderAmount),
      qrImage,
    };
  }

  async findAll(query: TransactionQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
      status,
      branchCode,
      dateFrom,
      dateTo,
    } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (branchCode) where.branchCode = { contains: branchCode };
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59.999Z') } : {}),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
        include: { customer: true },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: data.map((t) => ({ ...t, orderAmount: Number(t.orderAmount) })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: { customer: true, qrCode: true },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return { ...transaction, orderAmount: Number(transaction.orderAmount) };
  }

  async findMyTransactions(customerId: string, query: TransactionQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where = { customerId, status: 'completed' };

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: order },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: data.map((t) => ({ ...t, orderAmount: Number(t.orderAmount) })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
