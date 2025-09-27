# 保研小助手 (后端 + 前端 + Docker 部署指南)

本项目包含：
- 后端：Spring Boot 3 + JPA + Security + JWT (Java 17)
- 前端：Vite + React (打包后用 Nginx 提供静态文件，并反向代理 /api)
- 数据库：MySQL 8

已新增 Docker / docker-compose 支持，并将数据库连接、JWT 密钥、端口等改为可通过环境变量自定义。

## 目录结构简述
```
Dockerfile                # 后端镜像构建（多阶段）
frontend/Dockerfile       # 前端镜像构建（Node 构建 + Nginx 运行）
docker-compose.yml        # 一键编排（db + backend + frontend）
.env.example              # 环境变量示例（复制为 .env 使用）
src/main/resources/application.properties  # 已参数化 DB_URL/DB_USERNAME/DB_PASSWORD/JWT_SECRET/APP_PORT
```

## 快速开始（推荐使用 docker-compose）
1. 复制环境变量模板：
```
copy .env.example .env   # Windows CMD
```
2. 编辑 `.env`，至少修改：
   - `DB_PASSWORD` / `DB_ROOT_PASSWORD`
   - `JWT_SECRET` （长度建议 ≥ 64，随机且不可预测）
3. 构建并启动：
```
docker compose build
docker compose up -d
```
4. 访问：
   - 后端 API: `http://localhost:8080/api/...`
   - 前端页面: `http://localhost:3000/`
5. 查看日志：
```
docker compose logs -f backend
```
6. 停止并移除容器（保留数据卷）：
```
docker compose down
```
7. 如需同时删除数据卷（慎用）：
```
docker compose down -v
```

## 自定义数据库用户名与密码
- 通过 `.env` 中的 `DB_USERNAME` / `DB_PASSWORD` 设置应用使用的专用账号（不要再用 root）。
- `DB_ROOT_PASSWORD` 只用于初始化容器中的 root 口令。
- Spring Boot 连接使用的 URL 在 `docker-compose.yml` 中由 `DB_URL` 动态拼出，默认：
  `jdbc:mysql://db:3306/${DB_NAME}?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=UTF-8`
- 运行时也可直接 `docker compose run -e DB_PASSWORD=XXX backend` 临时覆盖。

## 环境变量一览（来自 .env.example）
| 变量 | 说明 | 示例 | 必需 |
|------|------|------|------|
| APP_PORT | 后端服务内部端口（容器内仍 8080，映射时用 compose） | 8080 | 否 |
| DB_NAME | 数据库名称 | xmudemo | 是 |
| DB_USERNAME | 应用使用的 MySQL 用户 | appuser | 是 |
| DB_PASSWORD | 应用用户密码 | AppChangeMe123! | 是 |
| DB_ROOT_PASSWORD | MySQL root 密码 | RootChangeMe123! | 是 |
| JWT_SECRET | JWT 签名密钥（≥64 字符） | 长随机串 | 是 |
| JAVA_OPTS | JVM 额外参数 | -Xms512m -Xmx512m | 否 |
| APP_CORS_ORIGINS | (可选) CORS 允许来源，逗号分隔 | http://localhost:3000 | 否 |

## 生成安全的 JWT 密钥示例
PowerShell：
```
# 生成 96 随机字节并 Base64
[Convert]::ToBase64String((New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes( (New-Object byte[] 96)))
```
OpenSSL（Git Bash / WSL）：
```
openssl rand -base64 96
```

## 单独构建后端镜像（不使用 compose）
```
docker build -t xmudemo-backend:latest .
docker run -d --name xmudemo-db -e MYSQL_ROOT_PASSWORD=RootPass123 -e MYSQL_DATABASE=xmudemo \
  -e MYSQL_USER=appuser -e MYSQL_PASSWORD=AppUserPass123 -p 3306:3306 mysql:8.3

# 等待数据库就绪后：
docker run -d --name xmudemo-backend --link xmudemo-db:db -p 8080:8080 \
  -e DB_USERNAME=appuser -e DB_PASSWORD=AppUserPass123 \
  -e DB_URL="jdbc:mysql://db:3306/xmudemo?createDatabaseIfNotExist=true&serverTimezone=UTC&characterEncoding=UTF-8" \
  -e JWT_SECRET=REPLACE_WITH_LONG_SECRET xmudemo-backend:latest
```

## 单独构建前端镜像（不使用 compose）
```
docker build -t xmudemo-frontend:latest ./frontend
# 假设后端在宿主 8080，需要运行时让 Nginx 代理到宿主 => 可自定义 nginx.conf 或用 compose 更简单。
```

## 升级 / 修改说明
- 若添加新依赖，重新 `docker compose build --no-cache backend`。
- 若只改 Java 代码，正常重新 build 即可；多阶段构建会重用缓存层。
- Jar 当前大小约 80+MB，可进一步使用 Spring Boot Layered JAR 优化（需要在 Dockerfile 中使用 `java -Djarmode=layertools` 分层提取）。

## 运行健康检查
- Dockerfile 中定义了 `HEALTHCHECK`：访问 `/actuator/health`。
- 已在 `SecurityConfig` 放行 `/actuator/health` 与 `/actuator/info`。

## 持久化目录
- `uploads` 通过 `uploads_data` 卷持久化。
- MySQL 数据通过 `db_data` 卷持久化。

## 常见问题 (FAQ)
1. 启动时后端报错 "Cannot connect to MySQL": 说明数据库还没就绪，compose 中已用 `depends_on` + healthcheck；若仍失败，可增加 `start_period` 或查看 `docker compose logs db`。
2. 端口占用：修改 `.env` 中的映射（例如把前端 3000 -> 3001、后端 8080 -> 8081，更新 compose `ports` 即可）。
3. JWT 过短或为空：会增加安全风险，务必使用高熵随机串。
4. 需要导出/恢复数据库：
```
# 备份
docker exec -i xmudemo-mysql mysqldump -uappuser -pAppChangeMe123! xmudemo > backup.sql
# 恢复
docker exec -i xmudemo-mysql mysql -uappuser -pAppChangeMe123! xmudemo < backup.sql
```

## 开发模式与 Docker 的切换
- 本地开发：直接使用 `quick-start.bat`（默认连接 localhost:3306）。
- Docker 部署：依赖容器内服务名 `db`，因此 `DB_URL` 在容器内部是 `jdbc:mysql://db:3306/...`。

## 未来可优化建议
- 使用 multi-stage + Spring Boot 分层构建减少重建时间
- 前端环境变量注入（如后端 API 地址）
- 增加测试用例并在镜像构建时执行（去掉 `-DskipTests`）
- 增加 CI/CD（GitHub Actions 构建并推送镜像）

---
如需进一步扩展或自动化部署（Kubernetes / 阿里云 / 华为云），可以继续补充配置文件。祝使用愉快！

