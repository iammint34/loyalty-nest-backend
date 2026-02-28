import { IsOptional, IsIn, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class RedemptionQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['active', 'verified', 'expired', 'cancelled'] })
  @IsOptional()
  @IsIn(['active', 'verified', 'expired', 'cancelled'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
