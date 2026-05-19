//! Bloom 过滤器实现
//!
//! 为每个分区文件的索引列创建 Bloom 过滤器，
//! 查询时快速跳过不相关分区（0.1% 误报率）。

use bloomfilter::Bloom;
use crate::models::BloomFilterSet;

/// 创建针对某列的 Bloom 过滤器
///
/// 参数:
/// - `items`: 列中的所有不同值
/// - `false_positive_rate`: 目标误报率（推荐 0.001 = 0.1%）
pub fn create_bloom_filter(items: &[u64], false_positive_rate: f64) -> Bloom<u64> {
    let expected_items = items.len().max(1);
    let mut bloom = Bloom::new_for_fp_rate(expected_items, false_positive_rate);
    for item in items {
        bloom.set(item);
    }
    bloom
}

/// 检查值是否可能存在于 Bloom 过滤器中
///
/// 返回 `true` 表示「可能存在」（需进一步验证），
/// `false` 表示「一定不存在」（可安全跳过）。
pub fn might_contain(bloom: &Bloom<u64>, value: u64) -> bool {
    bloom.check(&value)
}

/// 将 Bloom 过滤器序列化为 base64 字符串
pub fn serialize_bloom(bloom: &Bloom<u64>) -> String {
    use base64::Engine;
    let bytes = bloom.bitmap();
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

/// 构建完整的 Bloom 过滤器集合
pub fn build_filter_set(
    user_ids: &[u64],
    session_ids: &[u64],
    lock_ids: &[u64],
    zones: &[u64],
) -> BloomFilterSet {
    BloomFilterSet {
        user_id: if user_ids.is_empty() { None } else {
            Some(serialize_bloom(&create_bloom_filter(user_ids, 0.001)))
        },
        session_id: if session_ids.is_empty() { None } else {
            Some(serialize_bloom(&create_bloom_filter(session_ids, 0.001)))
        },
        lock_id: if lock_ids.is_empty() { None } else {
            Some(serialize_bloom(&create_bloom_filter(lock_ids, 0.001)))
        },
        zone: if zones.is_empty() { None } else {
            Some(serialize_bloom(&create_bloom_filter(zones, 0.001)))
        },
    }
}
