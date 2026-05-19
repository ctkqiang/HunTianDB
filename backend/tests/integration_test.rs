//! 混天DB 集成测试
//!
//! 测试完整的写入 → 环形缓冲区 → 排空流程。

use huntiandb::models::Event;
use huntiandb::storage::RingBuffer;
use std::sync::Arc;
use std::thread;

fn make_event(id: i64) -> Event {
    Event::new(id, 1, 100, 1, 0, 1, 1, 200, 0x7F000001)
}

#[test]
fn test_ring_buffer_concurrent_writes() {
    let rb = Arc::new(RingBuffer::new(100_000));
    let mut handles = vec![];

    for t in 0..8 {
        let rb = rb.clone();
        handles.push(thread::spawn(move || {
            for i in 0..10_000 {
                let id = t * 10_000 + i as i64;
                let mut pushed = rb.push(make_event(id));
                while pushed.is_err() {
                    pushed = rb.push(make_event(id));
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

#[test]
fn test_full_buffer_behavior() {
    let rb = RingBuffer::new(4);
    for i in 0..4 {
        assert!(rb.push(make_event(i)).is_ok());
    }
    assert!(rb.push(make_event(5)).is_err());
}

#[test]
fn test_event_serialization_roundtrip() {
    let event = make_event(42)
        .with_error("测试错误")
        .with_metadata(r#"{"key":"value"}"#);

    let bytes = bincode::serialize(&event).unwrap();
    let restored: Event = bincode::deserialize(&bytes).unwrap();

    assert_eq!(restored.id, 42);
    assert_eq!(restored.user_id, 1);
    assert_eq!(restored.error_msg, Some("测试错误".into()));
    assert_eq!(restored.metadata_json, Some(r#"{"key":"value"}"#.into()));
}
