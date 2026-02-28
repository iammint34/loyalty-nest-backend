import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RedemptionsService } from './redemptions.service';
import { CreateRedemptionDto } from './dto/create-redemption.dto';
import { RedemptionQueryDto } from './dto/redemption-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminOrApiKeyGuard } from '../../common/guards/admin-or-api-key.guard';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@ApiTags('Redemptions')
@Controller('redemptions')
export class RedemptionsController {
  constructor(
    private readonly redemptionsService: RedemptionsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Redeem a reward (customer)' })
  @ApiResponse({ status: 201, description: 'Redemption created' })
  @ApiResponse({ status: 400, description: 'Insufficient points or out of stock' })
  async create(
    @CurrentUser('sub') customerId: string,
    @Body() dto: CreateRedemptionDto,
  ) {
    const redemption = await this.redemptionsService.create(customerId, dto);
    return { data: redemption };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my redemptions (customer)' })
  async findMyRedemptions(
    @CurrentUser('sub') customerId: string,
    @Query() query: RedemptionQueryDto,
  ) {
    return this.redemptionsService.findMyRedemptions(customerId, query);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all redemptions (admin)' })
  async findAll(@Query() query: RedemptionQueryDto) {
    return this.redemptionsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get redemption by ID' })
  @ApiResponse({ status: 200, description: 'Redemption found' })
  @ApiResponse({ status: 404, description: 'Redemption not found' })
  async findOne(@Param('id') id: string) {
    const redemption = await this.redemptionsService.findOne(id);
    return { data: redemption };
  }

  @Post(':id/verify')
  @UseGuards(AdminOrApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a redemption (admin or POS)' })
  @ApiResponse({ status: 200, description: 'Redemption verified' })
  @ApiResponse({ status: 400, description: 'Cannot verify' })
  async verify(
    @CurrentUser('sub') adminUserId: string,
    @Param('id') id: string,
  ) {
    const redemption = await this.redemptionsService.verify(id);
    if (adminUserId) {
      this.auditLogsService
        .log({ adminUserId, action: 'verify', entity: 'redemption', entityId: id })
        .catch(() => {});
    }
    return { data: redemption };
  }
}
