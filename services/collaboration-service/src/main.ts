import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalErrorsFilter, env } from '@collab/common';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.useGlobalFilters(new GlobalErrorsFilter());
  await app.listen(Number(env('COLLABORATION_SERVICE_PORT', '3003')), '0.0.0.0');
}

void bootstrap();
