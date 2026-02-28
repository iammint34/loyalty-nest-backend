import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { RewardsService } from './rewards.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import { RewardQueryDto } from './dto/reward-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@ApiTags('Rewards')
@Controller('rewards')
export class RewardsController {
  constructor(
    private readonly rewardsService: RewardsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a reward (admin)' })
  @ApiResponse({ status: 201, description: 'Reward created' })
  async create(
    @CurrentUser('sub') adminUserId: string,
    @Body() dto: CreateRewardDto,
  ) {
    const reward = await this.rewardsService.create(dto);
    this.auditLogsService
      .log({ adminUserId, action: 'create', entity: 'reward', entityId: reward.id, details: { name: dto.name } })
      .catch(() => {});
    return { data: reward };
  }

  @Get('available')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available rewards (any authenticated user)' })
  async findAvailable() {
    const rewards = await this.rewardsService.findAvailable();
    return { data: rewards };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all rewards (admin)' })
  async findAll(@Query() query: RewardQueryDto) {
    return this.rewardsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reward by ID (any authenticated user)' })
  @ApiResponse({ status: 200, description: 'Reward found' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  async findOne(@Param('id') id: string) {
    const reward = await this.rewardsService.findOne(id);
    return { data: reward };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a reward (admin)' })
  @ApiResponse({ status: 200, description: 'Reward updated' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  async update(
    @CurrentUser('sub') adminUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRewardDto,
  ) {
    const reward = await this.rewardsService.update(id, dto);
    this.auditLogsService
      .log({ adminUserId, action: 'update', entity: 'reward', entityId: id, details: dto as unknown as Record<string, string> })
      .catch(() => {});
    return { data: reward };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate a reward (admin)' })
  @ApiResponse({ status: 200, description: 'Reward deactivated' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  async remove(
    @CurrentUser('sub') adminUserId: string,
    @Param('id') id: string,
  ) {
    const reward = await this.rewardsService.remove(id);
    this.auditLogsService
      .log({ adminUserId, action: 'delete', entity: 'reward', entityId: id })
      .catch(() => {});
    return { data: reward };
  }
}
