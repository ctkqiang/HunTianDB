//! mTLS 证书验证
//!
//! 双向 TLS 认证 — 加载 CA 证书并构建客户端验证器。

use std::path::Path;
use std::sync::Arc;
use rustls::server::WebPkiClientVerifier;
use rustls::server::danger::ClientCertVerifier;
use rustls::RootCertStore;
use crate::error::HunTianResult;

/// mTLS 配置
pub struct MtlsConfig {
    pub root_store: RootCertStore,
}

impl MtlsConfig {
    /// 从 CA 证书文件创建 mTLS 配置
    pub fn from_ca_cert(ca_cert_path: &Path) -> HunTianResult<Self> {
        let ca_data = std::fs::read(ca_cert_path)
            .map_err(|e| crate::error::HunTianError::Tls(format!("读取CA证书失败: {}", e)))?;

        let mut reader = std::io::BufReader::new(ca_data.as_slice());
        let certs = rustls_pemfile::certs(&mut reader)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| crate::error::HunTianError::Tls(format!("解析CA证书失败: {}", e)))?;

        let mut root_store = RootCertStore::empty();
        for cert in certs {
            root_store.add(cert)
                .map_err(|e| crate::error::HunTianError::Tls(format!("添加CA证书失败: {}", e)))?;
        }

        Ok(Self { root_store })
    }

    /// 创建客户端证书验证器
    pub fn create_verifier(&self) -> HunTianResult<Arc<dyn ClientCertVerifier>> {
        WebPkiClientVerifier::builder(Arc::new(self.root_store.clone()))
            .build()
            .map_err(|e| crate::error::HunTianError::Tls(format!("创建验证器失败: {}", e)))
    }
}
