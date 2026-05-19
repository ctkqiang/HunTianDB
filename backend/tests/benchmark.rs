//! 混天DB 性能基准测试
//!
//! 使用 Criterion 测量关键路径的吞吐量。

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use huntiandb::storage::RingBuffer;
use huntiandb::models::Event;
use std::sync::Arc;
use std::thread;

fn make_event(id: i64) -> Event {
    Event::new(id, (id % 1000) as i32, id * 10, 1, 0, 1, 1, 200, 0x7F000001)
}

/// 基准: 单线程 push 吞吐
fn bench_ring_buffer_push(c: &mut Criterion) {
    let mut group = c.benchmark_group("ring_buffer");

    for capacity in [10_000, 100_000, 1_000_000].iter() {
        let rb = RingBuffer::new(*capacity);

        group.bench_with_input(
            BenchmarkId::new("push", capacity),
            capacity,
            |b, _| {
                b.iter(|| {
                    // drain first to prevent full buffer
                    rb.drain_batch(*capacity);
                    for i in 0..1000 {
                        rb.push(make_event(i)).unwrap();
                    }
                });
            },
        );
    }
    group.finish();
}

/// 基准: 多线程并发 push
fn bench_concurrent_push(c: &mut Criterion) {
    let rb = Arc::new(RingBuffer::new(1_000_000));

    c.bench_function("concurrent_push_4threads", |b| {
        b.iter(|| {
            let mut handles = vec![];
            for t in 0..4 {
                let rb = rb.clone();
                handles.push(thread::spawn(move || {
                    for i in 0..1000 {
                        let event = make_event(t * 1000 + i as i64);
                        while rb.push(event).is_err() {
                            thread::yield_now();
                        }
                    }
                }));
            }
            for h in handles {
                h.join().unwrap();
            }
            rb.drain_batch(4000);
        });
    });
}

criterion_group!(benches, bench_ring_buffer_push, bench_concurrent_push);
criterion_main!(benches);
