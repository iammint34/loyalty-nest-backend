import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({ example: '+639171234567', description: 'Philippine phone number' })
  @IsString()
  @Matches(/^\+63\d{10}$/, { message: 'phoneNumber must be a valid PH number (+63XXXXXXXXXX)' })
  phoneNumber: string;
}
