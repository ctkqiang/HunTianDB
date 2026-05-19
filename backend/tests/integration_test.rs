//! 混天DB 集成测试
//!
//! 测试完整的写入 → WAL → Parquet → 查询流程。

use chrono::Utc;
use huntiandb::models::Event;
use huntiandb::storage::RingBuffer;

/// 测试: 环形缓冲区高并发写入
#[test]
fn test_ring_buffer_concurrent_writes() {
    use std::sync::Arc;
    use std::thread;

    let rb = Arc::new(RingBuffer::new(100_000));
    let mut handles = vec![];

    for t in 0..8 {
        let rb = rb.clone();
        handles.push(thread::spawn(move || {
            for i in 0..10_000 {
                let event = Event::new(
                    t * 10_000 + i as i64,
                    (t * 100) as i32,
                    t * 1000,
                    1, 0, 1, 1, 200, 0x7F000001,
                );
                while rb.push(event).is_err() {
                    thread::yield_now();
                }
            }
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    assert_eq!(rb.len(), 80_000);

    let batch = rb.drain_batch(80_000);
    assert_eq!(batch.len(), 80_000);
}

/// 测试: 缓冲区满载行为
#[test]
fn test_full_buffer_behavior() {
    let rb = RingBuffer::new(4);

    for i in 0..4 {
        rb.push(Event::new(i, 1, 100, 1, 0, 1, 1, 200, 0)).unwrap();
    }

    assert!(rb.push(Event::new(5, 1, 100, 1, 0, 1, 1, 200, 0)).is_err());
}

/// 测试: 事件序列化往返
#[test]
fn test_event_serialization_roundtrip() {
    let event = Event::new(42, 7, 999, 1, 5, 3, 2, 200, 0x7F000001)
        .with_error("测试错误")
        .with_metadata(r#"{"key":"value"}"#);

    let bytes = bincode::serialize(&event).unwrap();
    let restored: Event = bincode::deserialize(&bytes).unwrap();

    assert_eq!(restored.id, 42);
    assert_eq!(restored.user_id, 7);
    assert_eq!(restored.session_id, 999);
    assert_eq!(restored.error_msg, Some("测试错误".into()));
    assert_eq!(restored.metadata_json, Some(r#"{"key":"value"}"#.into()));
}
