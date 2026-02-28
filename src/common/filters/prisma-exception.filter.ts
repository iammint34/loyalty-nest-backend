import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FastifyReply } from 'fastify';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error';

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const fields =
          (exception.meta?.target as string[])?.join(', ') || 'field';
        message = `A record with this ${fields} already exists`;
        break;
      }
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid reference: related record not found';
        break;
    }

    this.logger.warn(
      `Prisma ${exception.code}: ${message} (target: ${(exception.meta?.target as string[])?.join(', ') || 'unknown'})`,
    );

    response.status(status).send({
      statusCode: status,
      error: HttpStatus[status]?.replace(/_/g, ' ') || 'Error',
      message,
    });
  }
}
