FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY packages/types/package.json packages/types/package.json
COPY packages/common/package.json packages/common/package.json
COPY apps/api-gateway/package.json apps/api-gateway/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY services/auth-service/package.json services/auth-service/package.json
COPY services/document-service/package.json services/document-service/package.json
COPY services/collaboration-service/package.json services/collaboration-service/package.json
COPY services/notification-service/package.json services/notification-service/package.json
RUN npm install

COPY . .
ARG VITE_API_URL=/api
ARG VITE_WS_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
RUN npm run build -w @collab/types \
  && npm run build -w @collab/frontend

FROM nginx:1.27-alpine AS prod
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
