# Frontend multi-stage build (Vite -> static, served by nginx)
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./ 2>/dev/null || true
RUN npm set progress=false && npm config set fund false
COPY . .
RUN npm install --omit=dev=false && npm run build

FROM nginx:1.27-alpine AS prod
WORKDIR /usr/share/nginx/html
# Clean default content
RUN rm -rf ./*
COPY --from=build /app/build ./
# Custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://localhost/ || exit 1

