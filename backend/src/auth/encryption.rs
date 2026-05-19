//! 密钥管理与加密模块
//!
//! 基于 AES-256-GCM 的静态数据加密，
//! HKDF-SHA256 密钥派生，支持密钥轮换。

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use hkdf::Hkdf;
use sha2::Sha256;
use crate::error::{HunTianError, HunTianResult};

/// 加密管理器
///
/// 持有主密钥，通过 HKDF 派生不同用途的子密钥。
pub struct EncryptionManager {
    /// 主密钥（32字节）
    master_key: Vec<u8>,
}

impl EncryptionManager {
    /// 从主密钥创建加密管理器
    pub fn new(master_key: &[u8]) -> Self {
        Self {
            master_key: master_key.to_vec(),
        }
    }

    /// 通过 HKDF-SHA256 派生指定用途的子密钥
    ///
    /// `info` 标识密钥用途（如 "wal-encryption"、"metadata"）。
    pub fn derive_key(&self, info: &[u8]) -> HunTianResult<Vec<u8>> {
        let hkdf = Hkdf::<Sha256>::new(None, &self.master_key);
        let mut okm = vec![0u8; 32]; // 256-bit key
        hkdf.expand(info, &mut okm)
            .map_err(|e| HunTianError::Internal(format!("HKDF 派生失败: {}", e)))?;
        Ok(okm)
    }

    /// AES-256-GCM 加密
    ///
    /// 返回 (nonce, ciphertext) 二元组。
    /// nonce 为 12 字节随机数，ciphertext 包含认证标签。
    pub fn encrypt(&self, key: &[u8], plaintext: &[u8]) -> HunTianResult<(Vec<u8>, Vec<u8>)> {
        let cipher_key = aes_gcm::Key::<Aes256Gcm>::from_slice(key);
        let cipher = Aes256Gcm::new(cipher_key);

        let mut nonce_bytes = [0u8; 12];
        getrandom::getrandom(&mut nonce_bytes)
            .map_err(|e| HunTianError::Internal(format!("随机数生成失败: {}", e)))?;
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| HunTianError::Internal(format!("AES-GCM 加密失败: {}", e)))?;

        Ok((nonce_bytes.to_vec(), ciphertext))
    }

    /// AES-256-GCM 解密
    pub fn decrypt(&self, key: &[u8], nonce: &[u8], ciphertext: &[u8]) -> HunTianResult<Vec<u8>> {
        let cipher_key = aes_gcm::Key::<Aes256Gcm>::from_slice(key);
        let cipher = Aes256Gcm::new(cipher_key);
        let nonce = Nonce::from_slice(nonce);

        cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| HunTianError::Internal(format!("AES-GCM 解密失败: {}", e)))
    }
}
