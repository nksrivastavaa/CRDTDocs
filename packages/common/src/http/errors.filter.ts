import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response, Request } from 'express';
import type { ApiErrorShape } from '@collab/types';

@Catch()
export class GlobalErrorsFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalErrorsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : null;
    const message =
      typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse
        ? String((exceptionResponse as { message: string | string[] }).message)
        : exception instanceof Error
          ? exception.message
          : 'Unexpected server error';

    if (statusCode >= 500) {
      this.logger.error(message, exception instanceof Error ? exception.stack : undefined);
    }

    const body: ApiErrorShape = {
      statusCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }
}
