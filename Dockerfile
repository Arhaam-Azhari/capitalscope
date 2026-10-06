FROM node:22-alpine AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM maven:3.9-eclipse-temurin-17 AS backend
WORKDIR /app/backend
COPY backend/ ./
COPY --from=web /app/frontend/dist/ ./src/main/resources/static/
RUN mvn --batch-mode verify

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=backend /app/backend/target/capitalscope-0.1.0.jar app.jar
USER 10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
