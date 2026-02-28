import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class TransactionItemDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;
}

export class CreateTransactionDto {
  @ApiProperty({ example: 'POS-001-20260221-0001' })
  @IsString()
  posTransactionRef: string;

  @ApiProperty({ example: 1250.0 })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  orderAmount: number;

  @ApiPropertyOptional({ example: 'BR-001' })
  @IsOptional()
  @IsString()
  branchCode?: string;

  @ApiPropertyOptional({ type: [TransactionItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionItemDto)
  items?: TransactionItemDto[];
}
