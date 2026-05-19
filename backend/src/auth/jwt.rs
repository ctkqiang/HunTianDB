//! JWT Token 管理
//!
//! 生成和验证 JSON Web Token，
//! 用于 REST API 的无状态认证。

use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use chrono::{Utc, Duration};
use crate::error::{HunTianError, HunTianResult};

/// JWT 载荷（Claims）
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// 用户ID
    pub sub: String,
    /// 用户名
    pub username: String,
    /// 角色
    pub role: String,
    /// 过期时间（UTC时间戳）
    pub exp: usize,
    /// 签发时间
    pub iat: usize,
}

/// JWT 管理器
pub struct JwtManager {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
}

impl JwtManager {
    /// 从密钥字符串创建 JWT 管理器
    pub fn new(secret: &str) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret.as_bytes()),
            decoding_key: DecodingKey::from_secret(secret.as_bytes()),
        }
    }

    /// 签发新的 JWT Token（有效期24小时）
    pub fn issue_token(
        &self,
        user_id: &str,
        username: &str,
        role: &str,
    ) -> HunTianResult<String> {
        let now = Utc::now();
        let claims = Claims {
            sub: user_id.to_string(),
            username: username.to_string(),
            role: role.to_string(),
            iat: now.timestamp() as usize,
            exp: (now + Duration::hours(24)).timestamp() as usize,
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|e| HunTianError::Auth(format!("JWT 签发失败: {}", e)))
    }

    /// 验证并解析 JWT Token
    pub fn validate_token(&self, token: &str) -> HunTianResult<Claims> {
        let token_data = decode::<Claims>(
            token,
            &self.decoding_key,
            &Validation::default(),
        )
        .map_err(|e| HunTianError::Auth(format!("JWT 验证失败: {}", e)))?;

        Ok(token_data.claims)
    }
}
