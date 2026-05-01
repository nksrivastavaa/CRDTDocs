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
RUN npm run build -w @collab/types \
  && npm run build -w @collab/common \
  && npm run build -w @collab/collaboration-service

FROM node:20-bookworm-slim AS prod
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/collaboration-service/dist ./services/collaboration-service/dist
COPY --from=build /app/services/collaboration-service/package.json ./services/collaboration-service/package.json

EXPOSE 3003
CMD ["node", "services/collaboration-service/dist/main.js"]
