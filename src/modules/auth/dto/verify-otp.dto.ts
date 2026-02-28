import { IsString, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: '+639171234567', description: 'Philippine phone number' })
  @IsString()
  @Matches(/^\+63\d{10}$/, { message: 'phoneNumber must be a valid PH number (+63XXXXXXXXXX)' })
  phoneNumber: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @IsString()
  @Length(6, 6, { message: 'code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'code must contain only digits' })
  code: string;
}
