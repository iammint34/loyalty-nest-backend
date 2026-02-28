import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { SmsService } from './sms.service';
import {
  JwtPayload,
  JwtRefreshPayload,
} from '../../common/interfaces/jwt-payload.interface';
import {
  OTP_LENGTH,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
} from '../../common/constants/index';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly customersService: CustomersService,
    private readonly smsService: SmsService,
  ) {}

  async requestOtp(phoneNumber: string) {
    // Delete existing OTPs for this phone
    await this.prisma.otpCode.deleteMany({ where: { phoneNumber } });

    // Generate 6-digit code
    const code = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otpCode.create({
      data: { phoneNumber, code, expiresAt },
    });

    await this.smsService.sendOtp(phoneNumber, code);

    this.logger.log(`OTP requested for ${phoneNumber}`);
    return { expiresAt };
  }

  async verifyOtp(phoneNumber: string, code: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phoneNumber },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new UnauthorizedException('No OTP found for this phone number');
    }

    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.otpCode.delete({ where: { id: otp.id } });
      throw new UnauthorizedException(
        'Too many attempts. Please request a new OTP',
      );
    }

    if (new Date() > otp.expiresAt) {
      await this.prisma.otpCode.delete({ where: { id: otp.id } });
      throw new UnauthorizedException('OTP has expired');
    }

    if (otp.code !== code) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: otp.attempts + 1 },
      });
      throw new UnauthorizedException('Invalid OTP');
    }

    // OTP is valid - delete it
    await this.prisma.otpCode.delete({ where: { id: otp.id } });

    // Find or create customer
    let customer = await this.customersService.findByPhone(phoneNumber);
    const isNew = !customer;
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: { phoneNumber },
      });
    }

    this.logger.log(
      `OTP verified for ${phoneNumber} (${isNew ? 'new' : 'returning'} customer ${customer.id})`,
    );

    const tokens = this.generateTokens({
      sub: customer.id,
      role: 'customer',
      phoneNumber: customer.phoneNumber,
    });

    return { ...tokens, customer };
  }

  async adminLogin(email: string, password: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.generateTokens({
      sub: admin.id,
      role: admin.role as JwtPayload['role'],
      email: admin.email,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _excluded, ...adminWithoutPassword } = admin;

    this.logger.log(`Admin login: ${admin.email} (role=${admin.role})`);
    return { ...tokens, admin: adminWithoutPassword };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Check if the subject is a customer or admin
      const customer = await this.prisma.customer.findUnique({
        where: { id: payload.sub },
      });

      if (customer) {
        this.logger.log(`Token refreshed for customer ${customer.id}`);
        return this.generateTokens({
          sub: customer.id,
          role: 'customer',
          phoneNumber: customer.phoneNumber,
        });
      }

      const admin = await this.prisma.adminUser.findUnique({
        where: { id: payload.sub },
      });

      if (admin && admin.isActive) {
        this.logger.log(`Token refreshed for admin ${admin.email}`);
        return this.generateTokens({
          sub: admin.id,
          role: admin.role as JwtPayload['role'],
          email: admin.email,
        });
      }

      throw new UnauthorizedException('User not found');
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(payload: Omit<JwtPayload, 'iat' | 'exp'>) {
    const accessToken = this.jwtService.sign(
      { ...payload } as Record<string, unknown>,
      {
        secret: this.configService.get<string>('JWT_SECRET'),

        expiresIn: this.configService.get('JWT_EXPIRATION', '15m'),
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: payload.sub, type: 'refresh' } as Record<string, unknown>,
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),

        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
      },
    );

    return { accessToken, refreshToken };
  }

  private generateOtpCode(): string {
    const min = Math.pow(10, OTP_LENGTH - 1);
    const max = Math.pow(10, OTP_LENGTH) - 1;
    return String(Math.floor(min + Math.random() * (max - min + 1)));
  }
}
