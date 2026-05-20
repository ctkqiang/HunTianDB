# Security Policy / 安全策略

## Supported Versions / 支持的版本

| Version | Supported           |
| ------- | ------------------- |
| latest  | true                |
| < 1.0   | false (development) |

We only provide security updates for the **latest stable release**.

我们仅对**最新的稳定版本**提供安全更新。

---

## Reporting a Vulnerability / 报告漏洞

**Please DO NOT file a public issue** – security vulnerabilities must be reported privately.

**请勿提交公开的 Issue** – 安全漏洞必须通过非公开渠道报告。

### How to report / 报告方式

1. Send an email to **security@huntiandb.com** (replace with your actual security contact).
2. Use GPG encryption if possible (public key available on request).
3. Include the following information:
   - Affected version(s) / 受影响版本
   - Steps to reproduce / 复现步骤
   - Potential impact / 潜在影响
   - Any suggested fix (optional) / 建议的修复方案（可选）

We will acknowledge your report within **48 hours** and provide a timeline for disclosure.

我们将在 **48 小时内**确认收到您的报告，并提供披露时间表。

### What to expect / 预期响应

- **Acknowledgment**: within 48 hours / 48 小时内确认
- **Investigation**: up to 7 days / 最多 7 天调查
- **Fix development**: depends on severity (critical: < 7 days) / 修复开发时间取决于严重性（严重：<7 天）
- **Public disclosure**: 30 days after fix is released, or earlier with reporter consent / 修复发布后 30 天公开，或在报告人同意下提前公开

We will credit reporters in the release notes unless anonymity is requested.

除非报告人要求匿名，我们将在发布说明中致谢。

---

## Security Features of HunTianDB / HunTianDB 的安全特性

- **TLS 1.3** for encrypted wire protocol / 传输层加密协议
- **SCRAM-SHA-256** authentication / 身份认证
- **Role-Based Access Control (RBAC)** / 基于角色的访问控制
- **AES-256-GCM** for at‑rest encryption (WAL and data files) / 静态数据加密（WAL 和数据文件）
- **WAL crash recovery** with checksums / 带校验和的 WAL 崩溃恢复

If you find any weakness in these implementations, please report it responsibly.

如果您在这些实现中发现任何弱点，请负责任地报告。

---

## Bug Bounty / 漏洞奖励

Currently, we do not offer a bug bounty program. However, we do offer **public acknowledgement** and a **thank‑you** in the release notes.

我们目前不提供漏洞奖励计划，但会在发布说明中公开致谢。

---

## Security Best Practices for Users / 用户安全最佳实践

1. **Always use TLS** – never expose the PG wire protocol over plaintext networks.
2. **Enable encryption at rest** – set the `DB_ENCRYPTION_KEY` environment variable.
3. **Use strong passwords** for database users (SCRAM-SHA-256 enforced).
4. **Apply RBAC** – grant only necessary privileges to each user.
5. **Regular backups** – use WAL archiving for point‑in‑time recovery.

---

## Responsible Disclosure / 负责任披露

We follow industry standard responsible disclosure practices. Please give us reasonable time to fix the issue before any public disclosure.

我们遵循行业标准的负责任披露实践。请在公开披露前给我们合理的时间修复问题。

---

## Contact / 联系方式

- Security email: **security@huntiandb.com** (replace with your actual email)
- PGP fingerprint: (optional, if you use GPG)

---

## Related Policies / 相关文档

- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)

Thank you for helping keep HunTianDB secure!  
感谢您帮助维护 HunTianDB 的安全！
