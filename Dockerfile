# Multi-stage build: Frontend + Backend
FROM node:18-alpine AS frontend-build
WORKDIR /frontend

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# Backend build stage
FROM maven:3.9-eclipse-temurin-17 AS backend-build
WORKDIR /build

# Copy only pom first (for layer caching)
COPY pom.xml .

# Copy source
COPY src ./src

# Copy frontend build to backend static resources
COPY --from=frontend-build /frontend/build ./src/main/resources/static

# Build (skip tests for faster image build; enable if you add tests)
RUN mvn -q -e -DskipTests package \
    && cp target/*-SNAPSHOT.jar app.jar

# Runtime image (slim JRE)
FROM eclipse-temurin:17-jre-alpine AS runtime
WORKDIR /app

# Install curl for healthcheck and shadow for user management
RUN apk add --no-cache curl shadow \
    && addgroup -S app && adduser -S app -G app

# --- Runtime configuration ---
ENV APP_PORT=8080
ENV DB_URL="jdbc:mysql://db:3306/xmudemo?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=UTF-8"

# Copy the fat jar (version agnostic)
COPY --from=backend-build /build/app.jar app.jar

# Create uploads directory & adjust permissions
RUN mkdir -p /app/uploads && chown -R app:app /app

# Switch to non-root user for better security
USER app

# Expose application port
EXPOSE 8080

# Healthcheck (relies on actuator; adjust if disabled)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fs http://localhost:8080/actuator/health || exit 1

# Use fixed JVM parameters - avoid environment variable expansion issues
ENTRYPOINT ["java", "-Xms512m", "-Xmx1024m", "-XX:+UseG1GC", "-jar", "/app/app.jar"]
