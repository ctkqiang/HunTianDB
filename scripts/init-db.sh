#!/bin/bash
# 混天DB 数据库初始化脚本
# 创建数据目录并生成默认配置文件

set -e

DATA_DIR="${DATA_DIR:-./data}"
WAL_DIR="$DATA_DIR/wal"
PARQUET_DIR="$DATA_DIR/parquet"

echo "创建数据目录结构..."
mkdir -p "$WAL_DIR"
mkdir -p "$PARQUET_DIR"

# 生成默认加密密钥（仅开发环境，生产请使用安全密钥管理）
if [ -z "$DB_ENCRYPTION_KEY" ]; then
    echo "警告: DB_ENCRYPTION_KEY 未设置，生成临时密钥"
    DB_ENCRYPTION_KEY=$(openssl rand -base64 32)
    echo "export DB_ENCRYPTION_KEY=$DB_ENCRYPTION_KEY"
fi

echo "数据目录初始化完成: $DATA_DIR"
echo "  WAL:     $WAL_DIR"
echo "  Parquet: $PARQUET_DIR"
