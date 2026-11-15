FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=development
ENV NPM_CONFIG_CACHE=/tmp/npm-cache
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
RUN mkdir -p /tmp/npm-cache \
  && npm ci --include=dev --cache /tmp/npm-cache --no-audit --no-fund

COPY . .

ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build \
  && npm install -g serve@14.2.4 \
  && chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production

EXPOSE 3000
CMD ["/app/docker-entrypoint.sh"]
