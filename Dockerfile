# ── 混天DB 统一 Docker 镜像 ──
# 单镜像多端口: 5408 (PG Wire), 3000 (REST + Portal)
# 用法: docker run -p 5408:5408 -p 3000:3000 huntiandb

# ── Stage 1: 后端构建 ──
FROM rust:1.85-alpine AS backend-builder
RUN apk add --no-cache musl-dev pkgconfig openssl-dev
WORKDIR /build
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src/ ./src/
RUN cargo build --release --bin huntiandb && \
    strip target/release/huntiandb

# ── Stage 2: 前端构建 ──
FROM oven/bun:1-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

# ── Stage 3: 运行时 ──
FROM alpine:3.21

RUN apk add --no-cache libgcc ca-certificates tzdata curl && \
    adduser -D -h /app huntian

USER huntian
WORKDIR /app

# 后端二进制
COPY --from=backend-builder /build/target/release/huntiandb /app/

# 前端静态文件
COPY --from=frontend-builder /build/dist /app/static

# 数据目录
RUN mkdir -p /app/data

ENV DATA_DIR=/app/data
ENV STATIC_DIR=/app/static
ENV RUST_LOG=info

EXPOSE 5408 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["./huntiandb"]
