import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRedemptionDto {
  @ApiProperty({ example: 'clxyz123...' })
  @IsString()
  rewardId: string;
}
