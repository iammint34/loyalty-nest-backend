import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

interface ExceptionResponseObject {
  message?: string | string[];
  error?: string;
  details?: { message: string }[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    let details: { message: string }[] | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as ExceptionResponseObject;
        message = res.message || exception.message;
        error = res.error || 'Error';
        details = res.details;
      } else {
        message = exception.message;
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${status} ${error}: ${Array.isArray(message) ? message[0] : message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).send({
      statusCode: status,
      error,
      message: Array.isArray(message) ? message[0] : message,
      details: Array.isArray(message)
        ? message.map((m) => ({ message: m }))
        : details,
    });
  }
}
