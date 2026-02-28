import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { QrCodesService } from './qr-codes.service';
import { ScanQrDto } from './dto/scan-qr.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('QR Codes')
@Controller('qr-codes')
export class QrCodesController {
  constructor(private readonly qrCodesService: QrCodesService) {}

  @Post('scan')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Scan a QR code (customer)' })
  @ApiResponse({ status: 200, description: 'Points awarded' })
  @ApiResponse({ status: 404, description: 'QR code not found' })
  @ApiResponse({ status: 409, description: 'Already scanned' })
  @ApiResponse({ status: 410, description: 'QR code expired' })
  async scan(@Body() dto: ScanQrDto, @CurrentUser('sub') customerId: string) {
    const result = await this.qrCodesService.scan(dto.code, customerId);
    return { data: result };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get QR code by ID (admin)' })
  @ApiResponse({ status: 200, description: 'QR code found' })
  @ApiResponse({ status: 404, description: 'QR code not found' })
  async findOne(@Param('id') id: string) {
    const qrCode = await this.qrCodesService.findOne(id);
    return { data: qrCode };
  }
}
