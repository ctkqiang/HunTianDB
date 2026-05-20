# Pull Request Template for HunTianDB

Thank you for contributing to HunTianDB! Please complete the sections below.
感谢您为 HunTianDB 贡献代码！请填写以下内容。

---

## Description / 描述

**What does this PR do?**  
(Provide a clear and concise description of the changes.)
**此 PR 做了什么？**  
（清晰简洁地描述改动内容）

**Related issue(s):**  
Closes #(issue number)
**关联 Issue：**  
Closes #(issue 编号)

---

## Type of change / 变更类型

Please delete options that are not relevant.
请删除不适用的选项。

- [ ] Bug fix (non-breaking change which fixes an issue) / Bug 修复（非破坏性变更）
- [ ] New feature (non-breaking change which adds functionality) / 新功能（非破坏性变更）
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) / 破坏性变更（可能导致现有功能异常）
- [ ] Performance improvement (no functional change) / 性能优化（无功能变化）
- [ ] Documentation update / 文档更新
- [ ] Security enhancement / 安全增强
- [ ] Benchmark or test addition / 基准测试或测试用例添加

---

## Database / Protocol Impact / 数据库 / 协议影响

Check all that apply.
勾选适用的项。

- [ ] Changes affect **PG Wire Protocol** (SQL parsing, execution, or response) / 影响 **PG Wire 协议**（SQL 解析、执行、响应）
- [ ] Changes affect **WAL** (write-ahead log format, recovery logic) / 影响 **WAL**（预写日志格式、恢复逻辑）
- [ ] Changes affect **Storage Engine** (data layout, indexing, compaction) / 影响 **存储引擎**（数据布局、索引、压缩）
- [ ] Changes affect **Security** (authentication, encryption, RBAC) / 影响 **安全模块**（认证、加密、RBAC）
- [ ] Changes affect **REST API** (endpoints, request/response format) / 影响 **REST API**（端点、请求/响应格式）
- [ ] Changes are **internal only** (refactoring, tests, tooling) / 仅内部变更（重构、测试、工具）

---

## Testing Performed / 测试情况

Describe the tests you ran and the results.
描述您运行的测试及结果。

- [ ] Unit tests added / updated / 添加/更新了单元测试
- [ ] Integration tests added / updated / 添加/更新了集成测试
- [ ] Manual testing with `psql` / `pgbench` / 使用 `psql` / `pgbench` 进行手工测试
- [ ] Benchmark run (attach summary if applicable) / 运行了基准测试（如有结果请附上）
- [ ] WAL crash recovery tested (kill -9 + restart) / 测试了 WAL 崩溃恢复（kill -9 后重启）

**Test environment / 测试环境:**

- OS: (e.g., Ubuntu 22.04, macOS 14) / 操作系统：(例如 Ubuntu 22.04, macOS 14)
- Rust version: (e.g., 1.78) / Rust 版本：(例如 1.78)
- Hardware: (optional) / 硬件配置：（可选）

**Commands to verify / 验证命令：**

```bash
# Example / 示例
psql -h localhost -p 5409 -U admin -d huntiandb -c "SELECT version();"
```
