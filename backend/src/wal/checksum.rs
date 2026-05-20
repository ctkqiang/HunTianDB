//! WAL 校验和 — CRC32 计算与验证

use crc32fast::Hasher;

/// WAL 记录版本号 (v4: 含校验和 + LSN)
pub const WAL_VERSION: u8 = 0x04;

/// CRC32 校验和长度（字节）
pub const CRC32_LEN: usize = 4;

/// LSN 长度（字节）
pub const LSN_LEN: usize = 8;

/// 记录头总长度: [版本 1B][CRC32 4B][LSN 8B][uncomp_len 4B][comp_len 4B] = 21 字节
pub const RECORD_HEADER_LEN: usize = 1 + CRC32_LEN + LSN_LEN + 4 + 4;

/// 计算载荷的 CRC32 校验和。
pub fn compute_checksum(payload: &[u8]) -> u32 {
    let mut hasher = Hasher::new();
    hasher.update(payload);
    hasher.finalize()
}

/// 验证 WAL 记录: 输入为 [版本][CRC32 LE][LSN LE][uncomp_len LE][comp_len LE][压缩载荷]，
/// 返回 `Ok(lsn)` 或 `Err(computed, stored)`。
pub fn verify_record(record: &[u8]) -> Result<u64, (u32, u32)> {
    if record.len() < RECORD_HEADER_LEN {
        return Err((0, 0));
    }
    if record[0] != WAL_VERSION {
        return Err((0, 0));
    }

    let stored_crc = u32::from_le_bytes([record[1], record[2], record[3], record[4]]);
    let lsn = u64::from_le_bytes([
        record[5], record[6], record[7], record[8],
        record[9], record[10], record[11], record[12],
    ]);
    let comp_len = u32::from_le_bytes([record[17], record[18], record[19], record[20]]) as usize;

    if record.len() < RECORD_HEADER_LEN + comp_len {
        return Err((0, 0));
    }

    let payload = &record[RECORD_HEADER_LEN..RECORD_HEADER_LEN + comp_len];
    let computed = compute_checksum(payload);

    if computed == stored_crc {
        Ok(lsn)
    } else {
        Err((computed, stored_crc))
    }
}

/// 构建 WAL 记录: 返回 `[版本][CRC32 LE][LSN LE][uncomp_len LE][comp_len LE][压缩载荷]`。
pub fn build_record(lsn: u64, compressed_payload: &[u8], uncomp_len: u32) -> Vec<u8> {
    let crc = compute_checksum(compressed_payload);
    let comp_len = compressed_payload.len() as u32;

    let mut record = Vec::with_capacity(RECORD_HEADER_LEN + compressed_payload.len());
    record.push(WAL_VERSION);
    record.extend_from_slice(&crc.to_le_bytes());
    record.extend_from_slice(&lsn.to_le_bytes());
    record.extend_from_slice(&uncomp_len.to_le_bytes());
    record.extend_from_slice(&comp_len.to_le_bytes());
    record.extend_from_slice(compressed_payload);
    record
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checksum_roundtrip() {
        let payload = b"hello world test payload";
        let crc = compute_checksum(payload);
        assert!(crc > 0);

        let record = build_record(42, payload, 100);
        assert_eq!(record[0], WAL_VERSION);
        assert_eq!(verify_record(&record), Ok(42));
    }

    #[test]
    fn test_corruption_detection() {
        let payload = b"important data";
        let mut record = build_record(1, payload, 50);
        // 翻转载荷中的一个字节
        let last = record.len() - 1;
        record[last] ^= 0xFF;
        assert!(verify_record(&record).is_err());
    }
}
