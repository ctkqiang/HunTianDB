#![allow(deprecated)]
//! 混天 (HunTianDB) — 时序安全数据库
//!
//! 面向安全审计与金融数据的不可变列式存储引擎。
//!
//! # 核心特性
//!
//! - **高性能写入**: 1M events/sec 吞吐，无锁环形缓冲区
//! - **不可变存储**: 仅追加，无 UPDATE/DELETE
//! - **PG 协议兼容**: psql 直连，PostgreSQL wire protocol v3.0
//! - **企业安全**: TLS 1.3 + P-521 ECDHE + AES-256-GCM
//! - **列式查询**: Apache Arrow/Parquet + Bloom 过滤器 + SIMD
//! - **时间点快照**: 取证追踪与因果链分析

pub mod config;
pub mod error;
pub mod metrics;
pub mod models;
pub mod server;
pub mod auth;
pub mod query;
pub mod storage;
pub mod snapshot;
pub mod callback;
pub mod wal;
