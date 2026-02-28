import {
  IsString,
  IsOptional,
  IsIn,
  IsDateString,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRewardDto {
  @ApiProperty({ example: 'Free Chicken Inasal' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Redeem for one free chicken inasal meal' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['free_item', 'discount', 'voucher'] })
  @IsIn(['free_item', 'discount', 'voucher'])
  type: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  pointsCost: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  stockLimit?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ example: '2026-03-01T00:00:00.000Z' })
  @IsDateString()
  validFrom: string;

  @ApiProperty({ example: '2026-06-30T23:59:59.000Z' })
  @IsDateString()
  validUntil: string;
}
