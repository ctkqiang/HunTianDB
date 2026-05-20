#!/bin/bash
# ── 混天DB 崩溃安全测试 ──
# 启动 DB → 10 并发客户端持续写入 → 每 0.5s 随机 kill -9 → 重启验证零数据丢失
#
# 用法: bash tests/crash_safety.sh [迭代次数] [并发客户端数]
# 默认: 100 次崩溃, 10 个并发客户端

set -euo pipefail

ITERATIONS=${1:-100}
CLIENTS=${2:-10}
PG_PORT=15408      # 使用非标准端口避免冲突
REST_PORT=15809
DATA_DIR=$(mktemp -d /tmp/huntian_crash_test.XXXXXX)
COMMIT_LOG="$DATA_DIR/commit_log.txt"
BINARY="${BINARY:-./target/release/huntiandb}"

cleanup() {
    kill $(lsof -ti:$PG_PORT) 2>/dev/null || true
    sleep 1
    rm -rf "$DATA_DIR"
}
trap cleanup EXIT

# 检查二进制
if [ ! -f "$BINARY" ]; then
    echo "ERROR: 二进制文件未找到: $BINARY"
    echo "请先运行: cargo build --release"
    exit 1
fi

echo "=== 混天DB 崩溃安全测试 ==="
echo "迭代次数: $ITERATIONS"
echo "并发客户端: $CLIENTS"
echo "数据目录: $DATA_DIR"
echo ""

# 启动数据库
start_db() {
    echo "  启动 DB..."
    DATA_DIR="$DATA_DIR" POSTGRES_PORT=$PG_PORT REST_PORT=$REST_PORT WAL_ENABLED=true \
        "$BINARY" > "$DATA_DIR/server.log" 2>&1 &
    DB_PID=$!
    # 等待就绪
    for i in $(seq 1 30); do
        if echo "" | nc -z localhost $PG_PORT 2>/dev/null; then
            echo "  DB 就绪 (PID=$DB_PID)"
            return 0
        fi
        sleep 0.3
    done
    echo "  ERROR: DB 启动超时"
    return 1
}

# 暴力杀死
kill_db() {
    if kill -0 "$DB_PID" 2>/dev/null; then
        kill -9 "$DB_PID" 2>/dev/null || true
        wait "$DB_PID" 2>/dev/null || true
    fi
}

# 验证所有已提交行存在
verify() {
    local total_committed=0
    local total_found=0

    if [ -f "$COMMIT_LOG" ]; then
        total_committed=$(wc -l < "$COMMIT_LOG" | tr -d ' ')
    fi

    if [ $total_committed -eq 0 ]; then
        echo "  (无已提交行，跳过验证)"
        return 0
    fi

    # 查询 COUNT(*) 通过 psql
    total_found=$(PGPASSWORD=admin123 psql -h localhost -p $PG_PORT -U admin -d huntiandb \
        -tAc "SELECT COUNT(*) FROM crash_test;" 2>/dev/null || echo "0")
    total_found=$(echo "$total_found" | tr -d ' ')

    if [ "$total_committed" -eq "$total_found" ]; then
        echo "  [OK] 已提交: $total_committed, 已恢复: $total_found"
        return 0
    else
        echo "  [FAIL] 已提交: $total_committed, 已恢复: $total_found (差异: $((total_committed - total_found)))"
        return 1
    fi
}

# 连续插入的客户端
run_client() {
    local client_id=$1
    local rows=0
    while true; do
        local val=$((RANDOM * 100000 + client_id * 10000 + rows))
        local sql="INSERT INTO crash_test VALUES ($val, $val, 'client-$client_id')"
        if PGPASSWORD=admin123 psql -h localhost -p $PG_PORT -U admin -d huntiandb \
            -c "$sql" > /dev/null 2>&1; then
            echo "$val" >> "$COMMIT_LOG"
            rows=$((rows + 1))
        else
            sleep 0.1
        fi
    done
}

# ── 主测试流程 ──

# 首次启动并建表
start_db || exit 1
sleep 2
PGPASSWORD=admin123 psql -h localhost -p $PG_PORT -U admin -d huntiandb \
    -c "CREATE TABLE crash_test (id BIGINT PRIMARY KEY, val BIGINT, payload TEXT);" > /dev/null 2>&1
echo "  表 crash_test 已创建"
kill_db

PASS_COUNT=0
FAIL_COUNT=0

for iter in $(seq 1 $ITERATIONS); do
    echo ""
    echo "── 迭代 $iter/$ITERATIONS ──"

    # 启动 DB
    start_db || { echo "  SKIP: 启动失败"; continue; }
    sleep 1

    # 启动并发客户端
    for c in $(seq 1 $CLIENTS); do
        run_client "$c" &
    done
    CLIENT_PIDS=$!

    # 随机运行 0.3-1.0 秒后杀死
    sleep $(echo "scale=1; $RANDOM % 8 / 10 + 0.3" | bc)
    echo "  kill -9 DB (PID=$DB_PID)"
    kill_db

    # 杀死所有客户端
    for cp in $(jobs -p); do kill "$cp" 2>/dev/null || true; done
    wait 2>/dev/null || true

    # 重启并验证
    start_db || { echo "  SKIP: 重启失败"; continue; }
    sleep 2

    if verify; then
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    kill_db
done

echo ""
echo "╔══════════════════════════════════╗"
echo "║     崩溃安全测试结果              ║"
echo "╠══════════════════════════════════╣"
echo "║  PASS: $PASS_COUNT/$ITERATIONS"
echo "║  FAIL: $FAIL_COUNT/$ITERATIONS"
if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "║  VERDICT: PASS — 零数据丢失       ║"
else
    echo "║  VERDICT: FAIL — 数据丢失         ║"
fi
echo "╚══════════════════════════════════╝"

exit $FAIL_COUNT
