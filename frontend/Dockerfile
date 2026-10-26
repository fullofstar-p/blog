# ============================================================================
# 前端多阶段构建：Node 构建静态资源 → Nginx 托管 + 反向代理 /api
# ============================================================================
FROM node:20-alpine AS build

WORKDIR /app

# 先复制依赖清单，利用 Docker 层缓存（有 lockfile 时用 npm ci 保证可复现）
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# 再复制源码并构建
COPY . .
RUN npm run build

# ----------------------------------------------------------------------------
FROM nginx:1.27-alpine

# 站点配置：SPA fallback + /api 反向代理到 backend:8080
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
