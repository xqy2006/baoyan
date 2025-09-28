# 保研小助手

本项目包含：
- 后端：Spring Boot 3 + JPA + Security + JWT (Java 17)
- 前端：Vite + React（已打包进 Spring Boot JAR 的静态资源目录，直接由后端提供）
- 数据库：MySQL 8

当前部署模式：只需运行一个后端容器（+ MySQL）。原先单独的 `frontend` 容器已移除，如需独立前端 + Nginx，可自行恢复 `docker-compose.yml` 中的相关服务或使用 `frontend/` 目录重新构建。

## 目录结构简述
```
Dockerfile                 # 后端镜像（多阶段，包含静态前端）
docker-compose.yml         # 编排（db + backend）
.env.sample                # 环境变量示例（复制为 .env 使用）
frontend/                  # 前端源代码（构建产物已被后端打包，可选保留/更新）
src/main/resources/application.properties  # 参数化 DB/JWT/端口
uploads/                   # 运行期上传目录（Docker 中挂载卷）
```

## 快速开始（docker-compose 推荐）
1. 复制环境变量模板：
```
copy .env.sample .env    (Windows CMD)
# 或 Linux/macOS: cp .env.sample .env
```
2. 编辑 `.env`，至少修改：
   - `DB_PASSWORD` / `DB_ROOT_PASSWORD`
   - `JWT_SECRET` （长度 ≥ 64，随机不可预测）
3. 构建并启动：
```
docker compose build
docker compose up -d
```
4. 访问：
   - 应用（含前端页面 + API 接口）：`http://localhost:8080/`
   - 健康检查接口：`http://localhost:8080/actuator/health`
5. 查看日志：
```
docker compose logs -f backend
```
6. 停止：
```
docker compose down
```
7. 删除数据卷（慎用，会清空数据库与上传）：
```
docker compose down -v
```

## 环境变量一览（来自 .env.sample，可按需裁剪）
| 变量 | 说明 | 示例 | 必需 |
|------|------|------|------|
| APP_PORT | 后端服务端口（容器内固定 8080） | 8080 | 否 |
| DB_NAME | 数据库名 | xmudemo | 是 |
| DB_HOST | 数据库主机（compose 内为 db） | db | 否 |
| DB_USERNAME | 应用使用的 MySQL 用户 | appuser | 是 |
| DB_PASSWORD | 应用用户密码 | ChangeAppPwd456! | 是 |
| DB_ROOT_PASSWORD | MySQL root 密码 | ChangeRootPwd123! | 是 |
| DB_URL | 完整 JDBC URL（留空则用默认拼接或 application.properties 默认） | jdbc:mysql://db:3306/xmudemo?... | 否 |
| JWT_SECRET | JWT 签名密钥（≥64 字符） | 长随机串 | 是 |
| JAVA_OPTS | JVM 参数 | -Xms256m -Xmx512m | 否 |
| SPRING_PROFILES_ACTIVE | Spring 活动配置文件 | prod | 否 |
| APP_UPLOAD_DIR | 上传目录（默认 uploads） | /app/uploads | 否 |

## 生成安全的 JWT 密钥示例
PowerShell：
```
[Convert]::ToBase64String((New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes( (New-Object byte[] 96)))
```
OpenSSL（Git Bash / WSL）：
```
openssl rand -base64 96
```

## 仅构建后端镜像（不使用 compose）
```
docker build -t xmudemo-backend:latest .
# 启动数据库
docker run -d --name xmudemo-db -e MYSQL_ROOT_PASSWORD=RootPass123 -e MYSQL_DATABASE=xmudemo \
  -e MYSQL_USER=appuser -e MYSQL_PASSWORD=AppUserPass123 -p 3306:3306 mysql:8.3
# 等待数据库就绪后启动后端
docker run -d --name xmudemo-backend --link xmudemo-db:db -p 8080:8080 \
  -e DB_USERNAME=appuser -e DB_PASSWORD=AppUserPass123 \
  -e DB_URL="jdbc:mysql://db:3306/xmudemo?createDatabaseIfNotExist=true&serverTimezone=UTC&characterEncoding=UTF-8" \
  -e JWT_SECRET=REPLACE_WITH_LONG_SECRET xmudemo-backend:latest
```

## 如果你仍想单独构建前端
```
# 可选：只在需要分离部署或自定义 Nginx 时使用
cd frontend
npm install
npm run build   # 产物在 frontend/build
# （可将产物复制进后端 resources/static 或继续用独立 Nginx）
```

## 升级 / 修改说明
- 改动 Java 代码：`docker compose build backend && docker compose up -d`。
- 改动依赖：建议 `--no-cache` 重建。
- 想进一步缩小镜像：可用 Spring Boot 分层 JAR / distroless / jlink。

## 健康检查
- Dockerfile 使用 `/actuator/health`。
- 若关闭 actuator，请同步删除或修改 HEALTHCHECK，避免容器永远 unhealthy。

## 持久化
- `uploads` 目录：挂载 `uploads_data` 卷。
- MySQL：`db_data` 卷。

## 常见问题 (FAQ)
1. 数据库未就绪导致连接失败：compose 已用 healthcheck，仍失败可延长 `start_period`。
2. 想修改端口映射：编辑 `docker-compose.yml` 的 `ports: - "8080:8080"` 左侧数字。
3. JWT 太短：安全风险，务必使用高熵随机串。
4. 导出/恢复数据库：
```
# 备份
docker exec -i xmudemo-mysql mysqldump -uappuser -pChangeAppPwd456! xmudemo > backup.sql
# 恢复
docker exec -i xmudemo-mysql mysql -uappuser -pChangeAppPwd456! xmudemo < backup.sql
```

## 本地开发模式
```
# 启动本地 MySQL (确保 3306 可用，或修改 application.properties 默认 URL)
# 然后：
./quick-start.bat   (Windows)
```
访问：http://localhost:8080/
