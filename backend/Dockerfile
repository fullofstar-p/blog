# ============================================================================
# 后端多阶段构建：Maven 编译 -> JRE 运行（非 root）
# ============================================================================

# ---------- 构建阶段 ----------
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

# 先复制 pom.xml 并预下载依赖，利用 Docker 层缓存加速后续构建
COPY pom.xml .
RUN mvn -B -q -DskipTests dependency:go-offline

# 再复制源码并打包
COPY src ./src
RUN mvn -B -q -DskipTests package && cp target/blog-backend.jar /build/app.jar

# ---------- 运行阶段 ----------
FROM eclipse-temurin:17-jre-alpine
ENV TZ=Asia/Shanghai \
    JAVA_OPTS="-XX:MaxRAMPercentage=75 -Djava.security.egd=file:/dev/./urandom"

# 非 root 运行
RUN addgroup -S blog && adduser -S blog -G blog

WORKDIR /app
COPY --from=build /build/app.jar /app/app.jar
RUN chown -R blog:blog /app
USER blog

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
    CMD wget -q -O - http://127.0.0.1:8080/actuator/health | grep -q UP || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
