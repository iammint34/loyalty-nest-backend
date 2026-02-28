import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReportQueryDto } from './report-query.dto';

export class CustomerReportQueryDto extends ReportQueryDto {
  @ApiPropertyOptional({ example: 'day', enum: ['day', 'week', 'month'] })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  interval?: 'day' | 'week' | 'month' = 'day';
}
