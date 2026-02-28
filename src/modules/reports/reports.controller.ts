import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { CustomerReportQueryDto } from './dto/customer-report-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard overview statistics' })
  async getDashboard(@Query() query: ReportQueryDto) {
    const data = await this.reportsService.getDashboard(
      query.dateFrom,
      query.dateTo,
    );
    return { data };
  }

  @Get('promotions')
  @ApiOperation({ summary: 'Promotion performance analytics' })
  async getPromotionStats(@Query() query: ReportQueryDto) {
    const data = await this.reportsService.getPromotionStats(
      query.dateFrom,
      query.dateTo,
    );
    return { data };
  }

  @Get('rewards')
  @ApiOperation({ summary: 'Rewards analytics' })
  async getRewardStats() {
    const data = await this.reportsService.getRewardStats();
    return { data };
  }

  @Get('branches')
  @ApiOperation({ summary: 'Branch performance statistics' })
  async getBranchStats(@Query() query: ReportQueryDto) {
    const data = await this.reportsService.getBranchStats(
      query.dateFrom,
      query.dateTo,
    );
    return { data };
  }

  @Get('customers')
  @ApiOperation({ summary: 'Customer growth and engagement over time' })
  async getCustomerGrowth(@Query() query: CustomerReportQueryDto) {
    const data = await this.reportsService.getCustomerGrowth(
      query.dateFrom,
      query.dateTo,
      query.interval,
    );
    return { data };
  }
}
