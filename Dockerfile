# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
FROM eclipse-temurin:24.0.2_12-jdk-alpine@sha256:8fdbcb6bc6b846640cea7058e6eeb56c311fae4efaa506a213789134065c6b90 AS build
WORKDIR /build
COPY --chmod=0755 mvnw ./
COPY .mvn/ .mvn/
COPY pom.xml ./
COPY src/main/ src/main/
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -ntp -Dmaven.test.skip=true package

FROM eclipse-temurin:24.0.2_12-jre-alpine@sha256:4044b6c87cb088885bcd0220f7dc7a8a4aab76577605fa471945d2e98270741f
RUN addgroup -S supporthub && adduser -S -G supporthub supporthub
WORKDIR /app
COPY --from=build /build/target/supporthub.jar ./supporthub.jar
USER supporthub
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=35s --retries=6 \
    CMD wget --spider -q http://127.0.0.1:8080/actuator/health/readiness || exit 1
ENTRYPOINT ["java", "-jar", "/app/supporthub.jar"]
