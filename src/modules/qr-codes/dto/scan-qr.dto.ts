import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScanQrDto {
  @ApiProperty({ example: 'LR-550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @Matches(/^LR-/, { message: 'Invalid QR code format' })
  code: string;
}
