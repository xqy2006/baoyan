# Backend multi-stage build for Spring Boot
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

# Copy only pom first (for layer caching)
COPY pom.xml .
# (Optional) copy lock file(s) here if added later for better caching

# Copy source
COPY src ./src

# Build (skip tests for faster image build; enable if you add tests)
RUN mvn -q -e -DskipTests package \
    && cp target/*-SNAPSHOT.jar app.jar

# Runtime image (slim JRE)
FROM eclipse-temurin:17-jre-alpine AS runtime
WORKDIR /app

# Install curl for healthcheck (busybox wget sometimes limited)
RUN apk add --no-cache curl shadow \
    && addgroup -S app && adduser -S app -G app

# --- Runtime configuration ---
# Keep only SAFE defaults here; DO NOT bake real secrets.
ENV APP_PORT=8080
# NOTE: Quoted to avoid confusion with '&' characters in URL; Dockerfile ENV does not need escaping, but quotes improve readability.
# You can comment this line out entirely if you prefer providing DB_URL only at runtime or relying on application.properties default.
ENV DB_URL="jdbc:mysql://db:3306/xmudemo?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=UTF-8"
# Intentionally NOT setting DB_USERNAME / DB_PASSWORD here.
ENV JAVA_OPTS=""
# Optional profile
# ENV SPRING_PROFILES_ACTIVE=prod

# Copy the fat jar (version agnostic)
COPY --from=build /build/app.jar app.jar

# Create uploads directory & adjust permissions
RUN mkdir -p /app/uploads && chown -R app:app /app

# Switch to non-root user for better security
USER app

# Expose application port
EXPOSE 8080

# Healthcheck (relies on actuator; adjust if disabled)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fs http://localhost:8080/actuator/health || exit 1

# Use exec form; server.port is read from APP_PORT in application.properties
ENTRYPOINT ["sh","-c","exec java $JAVA_OPTS -jar app.jar"]
