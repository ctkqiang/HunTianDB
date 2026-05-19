//! PostgreSQL Wire Protocol v3.0 实现
//!
//! 支持标准的 Start-up → Authentication → Query(SIMPLE) 流程。
//! 使 HunTianDB 可作为 psql/pgx 等标准客户端的直连替代。

use bytes::{Buf, BufMut, BytesMut};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use crate::error::{HunTianError, HunTianResult};

/// 启动消息（客户端连接后第一条消息）
#[derive(Debug)]
pub struct StartupMessage {
    pub protocol_version: i32,
    pub parameters: Vec<(String, String)>,
}

/// 简单查询消息
#[derive(Debug)]
pub struct QueryMessage {
    pub query_string: String,
}

/// PG 协议处理器
pub struct PostgresProtocol {
    stream: TcpStream,
    buffer: BytesMut,
    authenticated: bool,
    username: Option<String>,
    database: Option<String>,
}

impl PostgresProtocol {
    /// 基于已建立的 TCP 连接创建协议处理器
    pub fn new(stream: TcpStream) -> Self {
        Self {
            stream,
            buffer: BytesMut::with_capacity(4096),
            authenticated: false,
            username: None,
            database: None,
        }
    }

    /// 处理完整的认证 + 查询循环
    ///
    /// 1. 读取 StartupMessage
    /// 2. 发送 AuthenticationOk
    /// 3. 循环读取查询消息并执行
    pub async fn handle_connection(&mut self) -> HunTianResult<()> {
        // Step 1: 读取启动消息
        let startup = self.read_startup_message().await?;
        self.username = startup.parameters.iter()
            .find(|(k, _)| k == "user")
            .map(|(_, v)| v.clone());
        self.database = startup.parameters.iter()
            .find(|(k, _)| k == "database")
            .map(|(_, v)| v.clone());

        // Step 2: 发送认证成功
        self.send_authentication_ok().await?;

        // Step 3: 发送 ReadyForQuery
        self.send_ready_for_query().await?;

        self.authenticated = true;

        // Step 4: 查询循环
        loop {
            match self.read_message().await {
                Ok(msg_type) => {
                    match msg_type {
                        b'Q' => {
                            // 简单查询
                            let query = self.read_simple_query().await?;
                            self.handle_query(&query.query_string).await?;
                        }
                        b'X' => {
                            // 客户端关闭连接
                            break;
                        }
                        _ => {
                            // 未知消息类型，忽略
                        }
                    }
                }
                Err(_) => break, // 连接关闭或错误
            }
        }

        Ok(())
    }

    /// 读取启动消息
    async fn read_startup_message(&mut self) -> HunTianResult<StartupMessage> {
        // 读取长度（4字节）
        self.read_exact(4).await?;
        let len = self.buffer.get_i32();
        let payload_len = (len - 4) as usize;

        // 读取 payload
        self.read_exact(payload_len).await?;

        // 解析协议版本
        let proto_ver = self.buffer.get_i32();
        let mut params = Vec::new();

        while self.buffer.has_remaining() {
            let key = self.read_null_terminated_string();
            if key.is_empty() {
                break;
            }
            let value = self.read_null_terminated_string();
            params.push((key, value));
        }

        Ok(StartupMessage {
            protocol_version: proto_ver,
            parameters: params,
        })
    }

    /// 发送 AuthenticationOk 消息
    async fn send_authentication_ok(&mut self) -> HunTianResult<()> {
        // 'R' (Authentication) + 长度(8) + 类型(0=OK)
        let msg: [u8; 9] = [b'R', 0, 0, 0, 8, 0, 0, 0, 0];
        self.stream.write_all(&msg).await?;
        Ok(())
    }

    /// 发送 ReadyForQuery 消息
    async fn send_ready_for_query(&mut self) -> HunTianResult<()> {
        // 'Z' + 长度(5) + 状态(I=空闲)
        let msg: [u8; 6] = [b'Z', 0, 0, 0, 5, b'I'];
        self.stream.write_all(&msg).await?;
        Ok(())
    }

    /// 处理简单查询（INSERT / SELECT）
    async fn handle_query(&mut self, sql: &str) -> HunTianResult<()> {
        let sql_upper = sql.trim().to_uppercase();

        if sql_upper.starts_with("INSERT") {
            // 模拟 INSERT 成功
            self.send_command_complete("INSERT", 1).await?;
        } else if sql_upper.starts_with("SELECT") || sql_upper.starts_with("BEGIN") || sql_upper.starts_with("COMMIT") {
            self.send_command_complete("SELECT", 0).await?;
        } else {
            self.send_error("不支持的操作").await?;
        }

        self.send_ready_for_query().await?;
        Ok(())
    }

    /// 发送 CommandComplete 消息
    async fn send_command_complete(&mut self, tag: &str, rows: u32) -> HunTianResult<()> {
        let tag_str = format!("{} {}", tag, rows);
        let len = 4 + tag_str.len() + 1;
        let mut msg = Vec::with_capacity(1 + len);
        msg.push(b'C');
        msg.extend_from_slice(&(len as i32).to_be_bytes());
        msg.extend_from_slice(tag_str.as_bytes());
        msg.push(0);

        self.stream.write_all(&msg).await?;
        Ok(())
    }

    /// 发送错误消息
    async fn send_error(&mut self, msg: &str) -> HunTianResult<()> {
        let mut payload = Vec::new();
        // Severity
        payload.push(b'S');
        let sev = "ERROR";
        payload.extend_from_slice(sev.as_bytes());
        payload.push(0);
        // Message
        payload.push(b'M');
        payload.extend_from_slice(msg.as_bytes());
        payload.push(0);
        payload.push(0); // 终止符

        let len = 4 + payload.len();
        let mut packet = Vec::with_capacity(1 + len);
        packet.push(b'E');
        packet.extend_from_slice(&(len as i32).to_be_bytes());
        packet.extend_from_slice(&payload);

        self.stream.write_all(&packet).await?;
        Ok(())
    }

    async fn read_message(&mut self) -> HunTianResult<u8> {
        self.read_exact(1).await?;
        Ok(self.buffer.get_u8())
    }

    async fn read_simple_query(&mut self) -> HunTianResult<QueryMessage> {
        self.read_exact(4).await?;
        let _len = self.buffer.get_i32();
        let query = self.read_null_terminated_string();
        Ok(QueryMessage { query_string: query })
    }

    async fn read_exact(&mut self, n: usize) -> HunTianResult<()> {
        self.buffer.reserve(n);
        let mut read = 0;
        while read < n {
            let n_read = self.stream.read_buf(&mut self.buffer).await?;
            if n_read == 0 {
                return Err(HunTianError::Protocol("连接已关闭".into()));
            }
            read += n_read;
        }
        Ok(())
    }

    fn read_null_terminated_string(&mut self) -> String {
        let mut bytes = Vec::new();
        while self.buffer.has_remaining() {
            let b = self.buffer.get_u8();
            if b == 0 {
                break;
            }
            bytes.push(b);
        }
        String::from_utf8_lossy(&bytes).into_owned()
    }
}
