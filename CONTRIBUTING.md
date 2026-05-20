# Contributing to HunTianDB / 为 HunTianDB 贡献

Thanks for your interest in contributing! All contributions are welcome – bug fixes, features, documentation, benchmarks, or security improvements.

感谢您的贡献意愿！我们欢迎所有类型的贡献 – 包括错误修复、新功能、文档、基准测试或安全改进。

## Table of Contents / 目录

1. [Getting Started / 入门指南](#getting-started--入门指南)
2. [Development Workflow / 开发流程](#development-workflow--开发流程)
3. [Code Standards / 代码规范](#code-standards--代码规范)
4. [Testing / 测试](#testing--测试)
5. [Benchmarking / 基准测试](#benchmarking--基准测试)
6. [Pull Request Process / PR 流程](#pull-request-process--pr-流程)
7. [Security Issues / 安全问题](#security-issues--安全问题)

---

## Getting Started / 入门指南

1. **Fork the repository** on GitHub.
2. **Clone your fork**: `git clone https://github.com/your-username/HunTianDB.git`
3. **Build the project**: `cargo build --release`
4. **Run tests**: `cargo test`
5. **Run the database**: `./target/release/huntiandb`

---

## Development Workflow / 开发流程

- Use **Rust nightly** or **stable 1.70+** (check `rust-toolchain.toml`).
- Format code: `cargo fmt`
- Lint code: `cargo clippy -- -D warnings`
- Commit messages: follow conventional commits (e.g., `feat: add COPY support`, `fix: wal recovery`)

---

## Code Standards / 代码规范

- **Rust style**: rustfmt with default settings.
- **Naming**: `snake_case` for variables/functions, `CamelCase` for types.
- **Documentation**: Write `///` comments for public APIs.
- **Unsafe code**: Avoid unless absolutely necessary, and document why.

---

## Testing / 测试

- Unit tests: `cargo test`
- Integration tests: `tests/` directory
- Protocol tests: Use `psql` and the provided benchmark script.

Run WAL recovery test manually:

```bash
pkill -9 huntiandb
./target/release/huntiandb &
psql -c "SELECT * FROM recovery_test"
```
