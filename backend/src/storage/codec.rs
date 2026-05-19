//! 压缩编码模块
//!
//! 提供 Snappy（快速）、LZ4（极速）和 Zstd（高压缩比）三种压缩器。

use crate::error::{HunTianError, HunTianResult};

/// 压缩算法枚举
#[derive(Debug, Clone, Copy)]
pub enum CompressionCodec {
    /// Snappy — 速度与压缩比的平衡（推荐用于事件数据）
    Snappy,
    /// LZ4 — 极速压缩，适合高吞吐写入
    Lz4,
    /// Zstd — 高压缩比，适合冷数据归档
    Zstd,
}

/// Snappy 压缩
pub fn snappy_compress(data: &[u8]) -> HunTianResult<Vec<u8>> {
    let mut encoder = snap::raw::Encoder::new();
    encoder
        .compress_vec(data)
        .map_err(|e| HunTianError::Internal(format!("Snappy 压缩失败: {}", e)))
}

/// Snappy 解压
pub fn snappy_decompress(data: &[u8]) -> HunTianResult<Vec<u8>> {
    let mut decoder = snap::raw::Decoder::new();
    decoder
        .decompress_vec(data)
        .map_err(|e| HunTianError::Internal(format!("Snappy 解压失败: {}", e)))
}

/// LZ4 压缩
pub fn lz4_compress(data: &[u8]) -> HunTianResult<Vec<u8>> {
    lz4::block::compress(data, None, true)
        .map_err(|e| HunTianError::Internal(format!("LZ4 压缩失败: {}", e)))
}

/// LZ4 解压
pub fn lz4_decompress(data: &[u8], original_size: usize) -> HunTianResult<Vec<u8>> {
    lz4::block::decompress(data, Some(original_size as i32))
        .map_err(|e| HunTianError::Internal(format!("LZ4 解压失败: {}", e)))
}

/// Zstd 压缩
pub fn zstd_compress(data: &[u8], level: i32) -> HunTianResult<Vec<u8>> {
    zstd::encode_all(data, level)
        .map_err(|e| HunTianError::Internal(format!("Zstd 压缩失败: {}", e)))
}

/// Zstd 解压
pub fn zstd_decompress(data: &[u8]) -> HunTianResult<Vec<u8>> {
    zstd::decode_all(data)
        .map_err(|e| HunTianError::Internal(format!("Zstd 解压失败: {}", e)))
}

/// 通用压缩接口
pub fn compress(codec: CompressionCodec, data: &[u8]) -> HunTianResult<Vec<u8>> {
    match codec {
        CompressionCodec::Snappy => snappy_compress(data),
        CompressionCodec::Lz4 => lz4_compress(data),
        CompressionCodec::Zstd => zstd_compress(data, 3),
    }
}

/// 通用解压接口
pub fn decompress(codec: CompressionCodec, data: &[u8], original_size: Option<usize>) -> HunTianResult<Vec<u8>> {
    match codec {
        CompressionCodec::Snappy => snappy_decompress(data),
        CompressionCodec::Lz4 => lz4_decompress(data, original_size.unwrap_or(data.len() * 4)),
        CompressionCodec::Zstd => zstd_decompress(data),
    }
}
