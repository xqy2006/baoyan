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

## 使用已构建好的镜像（推荐：直接拉取 GHCR 镜像）
如果你不想在本地构建镜像，可以直接使用我们在 GitHub Actions 中构建并推送到 GitHub Container Registry (GHCR) 的镜像：

镜像地址：
```
ghcr.io/xqy2006/baoyan:main
```

- 从 registry 拉取镜像（Windows CMD）：
```
docker pull ghcr.io/xqy2006/baoyan:main
```
- Linux / macOS（Bash / Zsh）：
```
docker pull ghcr.io/xqy2006/baoyan:main
```

- 直接以单容器方式运行（Windows CMD，使用 .env 环境变量文件）：
```
# 在 CMD 中：
setlocal enabledelayedexpansion
for /f "usebackq delims=" %%a in (".env") do (
  for /f "tokens=1* delims==" %%i in ("%%a") do (
    docker run -d --name xmudemo-backend --env "%%i=%%j" -p 8080:8080 ghcr.io/xqy2006/baoyan:main
  )
)
endlocal
```
- 直接以单容器方式运行（Linux / macOS，使用 .env）：
```
# 在 Bash/Zsh：
set -o allexport; source .env; set +o allexport
docker run -d --name xmudemo-backend --env-file <(grep -v '^#' .env | sed '/^$/d') -p 8080:8080 ghcr.io/xqy2006/baoyan:main
# 备注：某些 shell（如 macOS 默认 zsh）不支持 --env-file 接受进程替代符号；在这种情况下使用：
# docker run --env-file .env -d --name xmudemo-backend -p 8080:8080 ghcr.io/xqy2006/baoyan:main
```

- 推荐更简单的方法（直接指定必须的环境变量）：
```
# Windows CMD（示例）：
docker run -d --name xmudemo-backend -p 8080:8080 ^
  --env DB_USERNAME=appuser --env DB_PASSWORD=ChangeAppPwd456! ^
  --env DB_URL="jdbc:mysql://db:3306/xmudemo?createDatabaseIfNotExist=true&serverTimezone=UTC&characterEncoding=UTF-8" ^
  --env JWT_SECRET=REPLACE_WITH_LONG_SECRET ^
  ghcr.io/xqy2006/baoyan:main

# Linux/macOS（Bash/Zsh）：
docker run -d --name xmudemo-backend -p 8080:8080 \
  --env DB_USERNAME=appuser --env DB_PASSWORD=ChangeAppPwd456! \
  --env DB_URL="jdbc:mysql://db:3306/xmudemo?createDatabaseIfNotExist=true&serverTimezone=UTC&characterEncoding=UTF-8" \
  --env JWT_SECRET=REPLACE_WITH_LONG_SECRET \
  ghcr.io/xqy2006/baoyan:main
```

- 使用 docker-compose（把服务改为使用远程镜像而不是本地构建）：
```
# 在 docker-compose.override.yml 或直接修改 docker-compose.yml 中 backend 的部分为：
# backend:
#   image: ghcr.io/xqy2006/baoyan:main
#   env_file: .env
#   ports:
#     - "8080:8080"
#   volumes:
#     - uploads_data:/app/uploads
#   depends_on:
#     - db
```
然后运行（Windows CMD / PowerShell / Linux / macOS）：
```
# 现代 Docker 推荐使用：
docker compose pull backend
docker compose up -d backend

# 旧版或兼容写法（如果你仅能使用 docker-compose 命令）：
docker-compose pull backend
docker-compose up -d backend
```

说明：容器内部的应用仍监听 8080（容器内端口不可随意更改，见下节如何映射到宿主机任意端口）。

## 如何将服务部署到指定的宿主机端口
容器内应用监听固定 8080 端口，若你想把服务放在宿主机的其它端口（例如 8081 或 80），只需在端口映射中调整左侧端口：

- docker run（Windows CMD）：
```
docker run -d --name xmudemo-backend -p 8081:8080 --env-file .env ghcr.io/xqy2006/baoyan:main
```
- docker run（Linux / macOS，Bash/Zsh）：
```
docker run -d --name xmudemo-backend -p 8081:8080 --env-file .env ghcr.io/xqy2006/baoyan:main
```

- docker-compose（docker-compose.yml 或 override）：
```
ports:
  - "8081:8080"   # 将宿主机 8081 映射到容器 8080
```

示例：映射到 80（需要管理员权限或端口未被占用）：
- Windows CMD：
```
docker run -d --name xmudemo-backend -p 80:8080 --env-file .env ghcr.io/xqy2006/baoyan:main
```
- Linux/macOS：
```
# 如果主机使用 systemd 或有防火墙，确保 80 可用并允许流量
sudo docker run -d --name xmudemo-backend -p 80:8080 --env-file .env ghcr.io/xqy2006/baoyan:main
```
注意：在 Windows 下将宿主机 80 端口映射给 Docker 容器时，若已被系统服务占用（如 IIS、Http.sys），需先释放该端口或选择其它端口。

## 如何更新到最新的 GHCR 镜像
如果仓库的 GitHub Actions 已构建并推送了新镜像（主分支 `main` 或其他 tag），按下列步骤更新运行中的服务：

- 对于 docker-compose（推荐）：
```
# Windows / Linux / macOS（现代 docker）：
docker compose pull backend
docker compose up -d backend

# 兼容旧命令：
docker-compose pull backend
docker-compose up -d backend
```

- 对于单容器 docker run：
```
# Windows CMD：
docker pull ghcr.io/xqy2006/baoyan:main
docker stop xmudemo-backend || true
docker rm xmudemo-backend || true
docker run -d --name xmudemo-backend -p 8080:8080 --env-file .env ghcr.io/xqy2006/baoyan:main

# Linux / macOS（Bash）：
sudo docker pull ghcr.io/xqy2006/baoyan:main
sudo docker stop xmudemo-backend || true
sudo docker rm xmudemo-backend || true
sudo docker run -d --name xmudemo-backend -p 8080:8080 --env-file .env ghcr.io/xqy2006/baoyan:main
```
