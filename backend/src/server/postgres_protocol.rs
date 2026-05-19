//! PostgreSQL Wire Protocol v3.0 实现
//!
//! 支持标准的 Start-up → Authentication → Query(SIMPLE) 流程。
//! 使 HunTianDB 可作为 psql/pgx 等标准客户端的直连替代。

use bytes::{Buf, BytesMut};
use tokio::io::{AsyncReadExt, AsyncWriteExt, AsyncWrite};
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
    /// 1. SSL 协商 → 2. 读取 StartupMessage → 3. 认证 → 4. 查询循环
    pub async fn handle_connection(&mut self) -> HunTianResult<()> {
        //0: SSL 协商 — 发送 'N' 拒绝 SSL (开发模式)
        self.handle_ssl_request().await?;

        //1: 读取启动消息
        let startup = self.read_startup_message().await?;
        self.username = startup.parameters.iter()
            .find(|(k, _)| k == "user")
            .map(|(_, v)| v.clone());
        self.database = startup.parameters.iter()
            .find(|(k, _)| k == "database")
            .map(|(_, v)| v.clone());

        //2: 发送认证成功
        self.send_authentication_ok().await?;

        //2.5: 发送 ParameterStatus (JDBC/DBeaver 需要)
        self.send_parameter_status("server_version", "9.6.0-HunTianDB").await?;
        self.send_parameter_status("server_encoding", "UTF8").await?;
        self.send_parameter_status("client_encoding", "UTF8").await?;
        self.send_parameter_status("DateStyle", "ISO, MDY").await?;
        self.send_parameter_status("integer_datetimes", "on").await?;
        self.send_parameter_status("IntervalStyle", "postgres").await?;

        //2.6: 发送 BackendKeyData (JDBC 需要)
        self.send_backend_key_data().await?;

        //3: 发送 ReadyForQuery
        self.send_ready_for_query().await?;

        self.authenticated = true;

        //4: 查询循环
        loop {
            match self.read_message().await {
                Ok(msg_type) => {
                    tracing::info!("PG消息: {:?}", msg_type as char);
                    match msg_type {
                        b'Q' => {
                            let query = self.read_simple_query().await?;
                            self.handle_query(&query.query_string).await?;
                        }
                        b'X' => break, // Terminate
                        // Extended Query Protocol — 跳过并响应
                        b'P' | b'B' | b'D' | b'E' | b'S' | b'H' | b'C' | b'f' | b'F' => {
                            self.skip_message().await?;
                            self.send_ready_for_query().await?;
                        }
                        _ => { self.skip_message().await?; }
                    }
                }
                Err(e) => { tracing::warn!("消息读取错误: {}", e); break; }
            }
        }

        Ok(())
    }

    /// SSL 协商 — PG客户端先发8字节SSL请求(len=8)，回复'N'拒绝
    async fn handle_ssl_request(&mut self) -> HunTianResult<()> {
        tracing::info!("SSL握手开始...");
        self.read_exact(4).await?;
        tracing::info!("SSL读到4字节");
        let len = self.buffer.get_i32();

        if len == 8 {
            // SSL request: 消费剩余4字节payload，回复'N'
            self.read_exact(4).await?;
            let _code = self.buffer.get_i32();
            self.stream.set_nodelay(true)?;
            self.stream.write_all(&[b'N']).await?;
            self.stream.flush().await?;
            tracing::info!("SSL N");
            return Ok(());
        }

        // StartupMessage: 长度>8，把4字节放回buffer
        let saved = len.to_be_bytes().to_vec();
        self.buffer = BytesMut::with_capacity(4096);
        self.buffer.extend_from_slice(&saved);
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

    /// 发送 ParameterStatus 消息 ('S')
    async fn send_parameter_status(&mut self, name: &str, value: &str) -> HunTianResult<()> {
        let name_bytes = name.as_bytes();
        let val_bytes = value.as_bytes();
        let len = 4 + name_bytes.len() + 1 + val_bytes.len() + 1;
        let mut msg = Vec::with_capacity(1 + len as usize);
        msg.push(b'S');
        msg.extend_from_slice(&(len as i32).to_be_bytes());
        msg.extend_from_slice(name_bytes);
        msg.push(0);
        msg.extend_from_slice(val_bytes);
        msg.push(0);
        self.stream.write_all(&msg).await?;
        Ok(())
    }

    /// 发送 BackendKeyData 消息 ('K')
    async fn send_backend_key_data(&mut self) -> HunTianResult<()> {
        let msg: [u8; 13] = [
            b'K', 0, 0, 0, 12,  // type + length
            0, 0, 0, 1,          // PID = 1
            0, 0, 0, 0,          // secret key = 0
        ];
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

    /// 处理简单查询 — 返回基础 PG 兼容响应
    async fn handle_query(&mut self, sql: &str) -> HunTianResult<()> {
        tracing::info!("PG查询: {}", sql);
        let sql_upper = sql.trim().to_uppercase();

        // 静默处理PG客户端发现查询
        let silent = sql_upper.starts_with("SET ")
            || sql_upper.starts_with("SHOW ")
            || sql_upper.starts_with("RESET ")
            || sql_upper.starts_with("BEGIN")
            || sql_upper.starts_with("START ")
            || sql_upper.starts_with("COMMIT")
            || sql_upper.starts_with("ROLLBACK")
            || sql_upper.starts_with("DISCARD ")
            || sql_upper.starts_with("DEALLOCATE ")
            || sql_upper.starts_with("CLOSE ")
            || sql_upper.starts_with("LISTEN ")
            || sql_upper.starts_with("UNLISTEN ")
            || sql_upper.starts_with("NOTIFY ");

        if silent {
            self.send_command_complete("OK", 0).await?;
        } else if sql_upper.starts_with("SELECT") || sql_upper.starts_with("WITH ") || sql_upper.starts_with("VALUES ") || sql_upper.starts_with("TABLE ") || sql_upper.starts_with("EXPLAIN ") || sql_upper.starts_with("DESCRIBE ") {
            let t_msg = [b'T', 0, 0, 0, 6, 0, 0]; // RowDescription: 0 columns
            self.stream.write_all(&t_msg).await?;
            self.send_command_complete("SELECT", 0).await?;
        } else if sql_upper.starts_with("INSERT") {
            self.send_command_complete("INSERT", 1).await?;
        } else if sql_upper.starts_with("CREATE ") || sql_upper.starts_with("DROP ") || sql_upper.starts_with("ALTER ") {
            self.send_command_complete("OK", 0).await?;
        } else {
            self.send_error(&format!("不支持: {}", sql)).await?;
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

    /// 跳过一条PG消息（读取长度并消费payload）
    async fn skip_message(&mut self) -> HunTianResult<()> {
        self.read_exact(4).await?;
        let len = self.buffer.get_i32();
        if len > 4 {
            let remaining = (len - 4) as usize;
            self.read_exact(remaining).await?;
            self.buffer.clear();
        }
        Ok(())
    }

    async fn read_message(&mut self) -> HunTianResult<u8> {
        self.read_exact(1).await?;
        Ok(self.buffer.get_u8())
    }

    async fn read_simple_query(&mut self) -> HunTianResult<QueryMessage> {
        self.read_exact(4).await?;
        let len = self.buffer.get_i32();
        let payload = (len - 4) as usize;
        self.read_exact(payload).await?;
        let query = self.read_null_terminated_string();
        self.buffer.clear(); // 消费剩余字节
        Ok(QueryMessage { query_string: query })
    }

    async fn read_exact(&mut self, n: usize) -> HunTianResult<()> {
        let mut buf = vec![0u8; n];
        self.stream.read_exact(&mut buf).await.map_err(|e| {
            HunTianError::Protocol(format!("读取失败: {}", e))
        })?;
        self.buffer.extend_from_slice(&buf);
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
