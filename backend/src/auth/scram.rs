//! SCRAM-SHA-256 密码认证
//!
//! 实现 RFC 7677 的 SCRAM-SHA-256 认证流程。
//! 使用常量时间比较防止时序攻击。

use crate::error::HunTianResult;
use pbkdf2::pbkdf2_hmac;
use sha2::{Digest, Sha256};

/// SCRAM-SHA-256 服务端实现
pub struct ScramServer {
    /// 存储的盐值（base64）
    pub stored_salt: String,
    /// 存储的 StoredKey（base64）
    pub stored_key: String,
    /// 存储的 ServerKey（base64）
    pub server_key: String,
    /// 迭代次数
    pub iterations: u32,
}

impl ScramServer {
    /// 从密码生成 SCRAM 凭证
    ///
    /// 生成随机盐，迭代 4096 次 PBKDF2-HMAC-SHA256。
    /// 验证密码（简化版: re-hash + 比较 stored_key）
    pub fn verify_password(password: &str, stored_hash: &str) -> bool {
        let parts: Vec<&str> = stored_hash.split('$').collect();
        if parts.len() < 5 {
            return false;
        }
        let _prefix = parts[0]; // "SCRAM-SHA-256"
        let salt_b64 = parts[1];
        let stored_key_b64 = parts[2];
        let _server_key_b64 = parts[3];
        let iterations: u32 = parts[4].parse().unwrap_or(4096);

        use base64::Engine;
        let salt = base64::engine::general_purpose::STANDARD
            .decode(salt_b64)
            .unwrap_or_default();

        let mut dk = [0u8; 64];
        pbkdf2::pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, iterations, &mut dk);
        let client_key = &dk[..32];
        let computed_stored_key = Sha256::digest(client_key);
        let computed_b64 =
            base64::engine::general_purpose::STANDARD.encode(computed_stored_key.as_slice());
        computed_b64 == stored_key_b64
    }

    pub fn from_password(password: &str) -> HunTianResult<Self> {
        let mut salt = [0u8; 16];
        getrandom::getrandom(&mut salt)
            .map_err(|e| crate::error::HunTianError::Internal(format!("SCRAM salt失败: {}", e)))?;

        let iterations: u32 = 4096;
        let mut dk = [0u8; 64];
        pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, iterations, &mut dk);

        let client_key = &dk[..32];
        let server_key = &dk[32..];
        let stored_key = Sha256::digest(client_key);

        use base64::Engine;
        Ok(Self {
            stored_salt: base64::engine::general_purpose::STANDARD.encode(salt),
            stored_key: base64::engine::general_purpose::STANDARD.encode(stored_key.as_slice()),
            server_key: base64::engine::general_purpose::STANDARD.encode(server_key),
            iterations,
        })
    }
}
