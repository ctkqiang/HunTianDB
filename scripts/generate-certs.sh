#!/bin/bash
# 混天DB TLS 证书生成脚本
# 生成 P-521 ECDSA 自签名证书（开发/测试用）

set -e

CERT_DIR="./certs"
mkdir -p "$CERT_DIR"

echo "生成 CA 私钥 (P-521)..."
openssl ecparam -genkey -name secp521r1 -out "$CERT_DIR/ca.key"

echo "生成 CA 自签名证书..."
openssl req -new -x509 -days 3650 -key "$CERT_DIR/ca.key" \
  -out "$CERT_DIR/ca.crt" \
  -subj "/CN=HunTianDB CA/O=HunTianDB/C=CN"

echo "生成服务器私钥 (P-521)..."
openssl ecparam -genkey -name secp521r1 -out "$CERT_DIR/server.key"

echo "生成服务器 CSR..."
openssl req -new -key "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.csr" \
  -subj "/CN=localhost/O=HunTianDB Server/C=CN"

echo "签发服务器证书..."
openssl x509 -req -days 365 -in "$CERT_DIR/server.csr" \
  -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" -CAcreateserial \
  -out "$CERT_DIR/server.crt"

echo "生成客户端私钥 (P-521)..."
openssl ecparam -genkey -name secp521r1 -out "$CERT_DIR/client.key"

echo "生成客户端 CSR..."
openssl req -new -key "$CERT_DIR/client.key" \
  -out "$CERT_DIR/client.csr" \
  -subj "/CN=client/O=HunTianDB Client/C=CN"

echo "签发客户端证书..."
openssl x509 -req -days 365 -in "$CERT_DIR/client.csr" \
  -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" -CAcreateserial \
  -out "$CERT_DIR/client.crt"

# 清理 CSR 文件
rm -f "$CERT_DIR"/*.csr "$CERT_DIR"/*.srl

echo "证书生成完成:"
echo "  CA:     $CERT_DIR/ca.crt"
echo "  服务器: $CERT_DIR/server.crt / $CERT_DIR/server.key"
echo "  客户端: $CERT_DIR/client.crt / $CERT_DIR/client.key"
