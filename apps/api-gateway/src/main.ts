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

function proxy(targetEnv: string, fallback: string, servicePrefix: string) {
  const target = optionalEnv(targetEnv, fallback);
  logger.log(`Proxying ${targetEnv} traffic to ${target}`);

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path: string) => {
      // Express strips the mount path before the proxy sees it. Re-add the
      // service prefix so /api/auth/login becomes /auth/login upstream.
      if (path === '/' || path === '') {
        return servicePrefix;
      }

      return `${servicePrefix}${path}`;
    },
    proxyTimeout: 30_000,
    timeout: 30_000,
    on: {
      error: (error: Error, _request: http.IncomingMessage, response: http.ServerResponse | net.Socket) => {
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
  const app = await NestFactory.create(AppModule, { cors: true, bodyParser: false });
  const express = app.getHttpAdapter().getInstance();

  express.get('/api/health', (_request: Request, response: Response) => {
    response.json({ status: 'ok' });
  });

  express.use('/api/auth', proxy('AUTH_SERVICE_URL', 'http://localhost:3001', '/auth'));
  express.use('/api/users', proxy('AUTH_SERVICE_URL', 'http://localhost:3001', '/users'));
  express.use('/api/workspaces', proxy('DOCUMENT_SERVICE_URL', 'http://localhost:3002', '/workspaces'));
  express.use('/api/documents', proxy('DOCUMENT_SERVICE_URL', 'http://localhost:3002', '/documents'));
  express.use('/api/comments', proxy('DOCUMENT_SERVICE_URL', 'http://localhost:3002', '/comments'));
  express.use('/api/notifications', proxy('NOTIFICATION_SERVICE_URL', 'http://localhost:3004', '/notifications'));

  await app.listen(Number(env('API_GATEWAY_PORT', '3000')), '0.0.0.0');
}

void bootstrap();
