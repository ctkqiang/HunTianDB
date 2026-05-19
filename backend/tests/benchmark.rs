//! 混天DB 性能基准测试

use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId};
use huntiandb::storage::RingBuffer;
use huntiandb::models::Event;
use std::sync::Arc;
use std::thread;

fn make_event(id: i64) -> Event {
    Event::new(id, (id % 1000) as i32, id * 10, 1, 0, 1, 1, 200, 0x7F000001)
}

fn bench_ring_buffer_push(c: &mut Criterion) {
    let mut group = c.benchmark_group("ring_buffer");

    for capacity in [10_000, 100_000, 1_000_000].iter() {
        group.bench_with_input(
            BenchmarkId::new("push", capacity),
            capacity,
            |b, _| {
                let rb = RingBuffer::new(*capacity);
                b.iter(|| {
                    rb.drain_batch(*capacity);
                    for i in 0..1000 {
                        let event = make_event(i);
                        let mut pushed = rb.push(event);
                        while pushed.is_err() {
                            pushed = rb.push(make_event(i));
                        }
                    }
                });
            },
        );
    }
    group.finish();
}

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
                        let mut pushed = rb.push(event);
                        while pushed.is_err() {
                            pushed = rb.push(make_event(t * 1000 + i as i64));
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
