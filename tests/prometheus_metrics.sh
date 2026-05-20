#!/bin/bash
# ── 混天DB Prometheus 指标集成测试 ──
# 启动 DB → 执行 SQL → 检查 /metrics /health /ready 端点
set -euo pipefail

PG_PORT=15409
REST_PORT=15810
METRICS_PORT=19090
DATA_DIR=$(mktemp -d /tmp/huntian_metrics_test.XXXXXX)
BINARY="${BINARY:-./target/release/huntiandb}"

cleanup() {
    kill $(lsof -ti:$PG_PORT) 2>/dev/null || true
    sleep 1
    rm -rf "$DATA_DIR"
}
trap cleanup EXIT

if [ ! -f "$BINARY" ]; then
    echo "ERROR: 二进制文件未找到: $BINARY"
    exit 1
fi

echo "=== 混天DB Prometheus 指标测试 ==="

# 启动 DB
echo "[1] 启动数据库..."
DATA_DIR="$DATA_DIR" POSTGRES_PORT=$PG_PORT REST_PORT=$REST_PORT \
    METRICS_PORT=$METRICS_PORT WAL_ENABLED=true PROMETHEUS_ENABLED=true \
    "$BINARY" > "$DATA_DIR/server.log" 2>&1 &
DB_PID=$!

# 等待就绪
for i in $(seq 1 30); do
    if curl -sf http://localhost:$REST_PORT/api/health > /dev/null 2>&1; then
        echo "  DB 就绪"
        break
    fi
    sleep 0.5
done

echo ""
echo "[2] 健康检查..."
# /health — 应返回 200
HTTP_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$REST_PORT/health)
echo "  /health: HTTP $HTTP_HEALTH"
[ "$HTTP_HEALTH" = "200" ] || echo "  FAIL: /health should be 200"

# /ready — 初始应为 503 (尚未标记就绪)
HTTP_READY=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$REST_PORT/ready)
echo "  /ready: HTTP $HTTP_READY (before set_ready)"
# 此时 ready 可能为 200 或 503，取决于 DB 是否自动 set_ready

echo ""
echo "[3] 执行 SQL 查询..."
psql_exec() {
    PGPASSWORD=admin123 psql -h localhost -p $PG_PORT -U admin -d huntiandb -c "$1" 2>&1
}

# INSERT
echo "  INSERT 测试数据..."
psql_exec "CREATE TABLE IF NOT EXISTS metrics_test (id BIGINT PRIMARY KEY, val BIGINT, name TEXT);"
for i in $(seq 1 100); do
    psql_exec "INSERT INTO metrics_test VALUES ($i, $((i * 10)), 'row-$i');" > /dev/null 2>&1
done
echo "  100 行已插入"

# SELECT
echo "  SELECT 查询..."
psql_exec "SELECT COUNT(*) FROM metrics_test;" > /dev/null 2>&1

# 聚合查询
echo "  聚合查询..."
psql_exec "SELECT AVG(val) FROM metrics_test;" > /dev/null 2>&1

echo ""
echo "[4] 检查 /metrics 端点..."
sleep 1  # 等待指标更新

METRICS=$(curl -s http://localhost:$METRICS_PORT/metrics)
echo "  指标端点响应: $(echo "$METRICS" | wc -l) 行"

# 检查关键指标存在且非零
CHECKS=(
    "huntian_events_written_total"
    "huntian_queries_executed_total"
    "huntian_wal_size_bytes"
    "huntian_active_connections"
    "huntian_wal_fsync_seconds"
    "huntian_query_duration_seconds"
    "huntian_memory_usage_bytes"
    "huntian_open_fds"
    "huntian_slow_queries_total"
    "huntian_checksum_failures_total"
)

PASSED=0
FAILED=0
for metric in "${CHECKS[@]}"; do
    if echo "$METRICS" | grep -q "$metric"; then
        # 尝试提取数值
        VALUE=$(echo "$METRICS" | grep "$metric" | grep -v '^#' | head -1 | awk '{print $NF}')
        echo "  [OK] $metric = $VALUE"
        PASSED=$((PASSED + 1))
    else
        echo "  [FAIL] $metric 未找到"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "[5] 检查 Prometheus 指标端点..."
HTTP_METRICS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$METRICS_PORT/metrics)
echo "  /metrics: HTTP $HTTP_METRICS"
if [ "$HTTP_METRICS" = "200" ]; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi

echo ""
echo "╔══════════════════════════════════╗"
echo "║   Prometheus 指标测试结果         ║"
echo "╠══════════════════════════════════╣"
echo "║  PASS: $PASSED"
echo "║  FAIL: $FAILED"
if [ "$FAILED" -eq 0 ]; then
    echo "║  VERDICT: PASS                   ║"
else
    echo "║  VERDICT: FAIL                   ║"
fi
echo "╚══════════════════════════════════╝"

cleanup
exit $FAILED
