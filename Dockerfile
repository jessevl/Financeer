# Financeer Docker Build
# Multi-stage build for production static assets served by nginx

FROM node:22-alpine AS builder
WORKDIR /app/project

# Install dependencies (Frameer must exist at /app/Frameer for file:../Frameer)
COPY package*.json ./
COPY Frameer /app/Frameer
RUN cd /app/Frameer && npm ci && cd /app/project && npm ci

# Build app
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/project/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost/health || exit 1
