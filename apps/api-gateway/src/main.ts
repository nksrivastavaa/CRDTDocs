import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AppModule } from './app.module';
import { env, optionalEnv } from '@collab/common';
import { Request, Response } from 'express';
import * as http from 'http';
import * as net from 'net';

const logger = new Logger('ApiGateway');

function proxy(targetEnv: string, fallback: string) {
  const target = optionalEnv(targetEnv, fallback);
  logger.log(`Proxying ${targetEnv} traffic to ${target}`);

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: {
      '^/api/auth/(.*)': '/auth/$1',
      '^/api/auth$': '/auth',
      '^/api/users/(.*)': '/users/$1',
      '^/api/users$': '/users',
      '^/api/workspaces/(.*)': '/workspaces/$1',
      '^/api/workspaces$': '/workspaces',
      '^/api/documents/(.*)': '/documents/$1',
      '^/api/documents$': '/documents',
      '^/api/comments/(.*)': '/comments/$1',
      '^/api/comments$': '/comments',
      '^/api/notifications/(.*)': '/notifications/$1',
      '^/api/notifications$': '/notifications',
    },
    proxyTimeout: 30_000,
    timeout: 30_000,
    on: {
    error: (error: any, _request: http.IncomingMessage, response: http.ServerResponse | net.Socket) => {
        logger.error(`Proxy error: ${error.message}`);
        if ('writeHead' in response) {
          response.writeHead(502, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ statusCode: 502, message: 'Upstream service unavailable' }));
        }
      },
    },
  });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: true });
  const express = app.getHttpAdapter().getInstance();

express.get('/api/health', (_request: Request, response: Response) => {
    response.json({ status: 'ok' });
  });

  express.use('/api/auth', proxy('AUTH_SERVICE_URL', 'http://localhost:3001'));
  express.use('/api/users', proxy('AUTH_SERVICE_URL', 'http://localhost:3001'));
  express.use('/api/workspaces', proxy('DOCUMENT_SERVICE_URL', 'http://localhost:3002'));
  express.use('/api/documents', proxy('DOCUMENT_SERVICE_URL', 'http://localhost:3002'));
  express.use('/api/comments', proxy('DOCUMENT_SERVICE_URL', 'http://localhost:3002'));
  express.use('/api/notifications', proxy('NOTIFICATION_SERVICE_URL', 'http://localhost:3004'));

  await app.listen(Number(env('API_GATEWAY_PORT', '3000')), '0.0.0.0');
}

void bootstrap();
