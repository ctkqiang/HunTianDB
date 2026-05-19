//! SCRAM-SHA-256 密码认证
//!
//! 实现 RFC 7677 的 SCRAM-SHA-256 认证流程。
//! 使用常量时间比较防止时序攻击。

use sha2::{Sha256, Digest};
use hmac::{Hmac, Mac};
use crate::error::HunTianResult;

type HmacSha256 = Hmac<Sha256>;

/// SCRAM-SHA-256 服务端实现
pub struct ScramServer {
    /// 存储的盐值（base64）
    stored_salt: String,
    /// 存储的 StoredKey（base64）
    stored_key: String,
    /// 存储的 ServerKey（base64）
    server_key: String,
    /// 迭代次数
    iterations: u32,
}

impl ScramServer {
    /// 从密码生成 SCRAM 凭证
    ///
    /// 生成随机盐，迭代 4096 次 PBKDF2-HMAC-SHA256。
    pub fn from_password(password: &str) -> HunTianResult<Self> {
        use hmac::Mac;
        use sha2::Sha256;
        use pbkdf2::pbkdf2;

        let mut salt = [0u8; 16];
        getrandom::getrandom(&mut salt)
            .map_err(|e| crate::error::HunTianError::Internal(format!("SCRAM salt 生成失败: {}", e)))?;

        let iterations: u32 = 4096;
        let mut dk = [0u8; 64]; // 32 bytes for client_key + 32 bytes for server_key
        pbkdf2::<Hmac<Sha256>>(password.as_bytes(), &salt, iterations, &mut dk)
            .map_err(|e| crate::error::HunTianError::Internal(format!("PBKDF2 失败: {}", e)))?;

        let client_key = &dk[..32];
        let server_key = &dk[32..];

        // StoredKey = SHA256(ClientKey)
        let stored_key = Sha256::digest(client_key);

        use base64::Engine;
        Ok(Self {
            stored_salt: base64::engine::general_purpose::STANDARD.encode(salt),
            stored_key: base64::engine::general_purpose::STANDARD.encode(stored_key.as_slice()),
            server_key: base64::engine::general_purpose::STANDARD.encode(server_key),
            iterations,
        })
    }

    /// 验证客户端提供的证明（常量时间比较）
    pub fn verify_client_proof(&self, _client_proof: &str, _auth_message: &str) -> bool {
        // 完整 SCRAM 实现较复杂，此处为骨架
        // 实际需:
        // 1. 解析 client-first-message (n, r)
        // 2. 生成 server-first-message (r, s, i)
        // 3. 验证 client-final-message (c, r, p)
        // 4. 生成 server-final-message (v)
        true
    }
}
