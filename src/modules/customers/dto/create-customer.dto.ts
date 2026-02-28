import { IsString, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ example: '+639171234567', description: 'Philippine phone number' })
  @IsString()
  @Matches(/^\+63\d{10}$/, { message: 'phoneNumber must be a valid PH number (+63XXXXXXXXXX)' })
  phoneNumber: string;

  @ApiPropertyOptional({ example: 'Juan' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Dela Cruz' })
  @IsOptional()
  @IsString()
  lastName?: string;
}
