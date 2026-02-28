import { Injectable, Logger } from '@nestjs/common';

export interface ISmsService {
  sendOtp(phoneNumber: string, code: string): Promise<void>;
}

@Injectable()
export class SmsService implements ISmsService {
  private readonly logger = new Logger(SmsService.name);

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    // TODO: Replace with Semaphore SMS API in production
    this.logger.log(`[SMS STUB] OTP for ${phoneNumber}: ${code}`);
  }
}
