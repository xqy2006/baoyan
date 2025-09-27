# Backend multi-stage build for Spring Boot
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

# Copy only pom first (for layer caching)
COPY pom.xml .
# If you later add a dependency lock file, copy it here too.

# Copy source
COPY src ./src

# Build (skip tests for faster image build; enable if you add tests)
RUN mvn -q -e -DskipTests package

# Runtime image
FROM eclipse-temurin:17-jre-alpine AS runtime
WORKDIR /app

# Install curl for healthcheck (busybox wget sometimes limited)
RUN apk add --no-cache curl

# Environment variables (can be overridden at runtime)
ENV APP_PORT=8080 \
    DB_URL=jdbc:mysql://db:3306/xmudemo?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=UTF-8 \
    DB_USERNAME=root \
    DB_PASSWORD=123456 \
    JAVA_OPTS=""

# Copy the fat jar
COPY --from=build /build/target/xmudemo-0.0.1-SNAPSHOT.jar app.jar

# Expose application port
EXPOSE 8080

# Health metadata (optional)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 CMD curl -fs http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar app.jar"]
