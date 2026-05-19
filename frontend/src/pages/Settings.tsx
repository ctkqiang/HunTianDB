import { Card, Row, Col, Tag, Space, Divider } from "tdesign-react";
import { LinkIcon, MailIcon, UserIcon, ServerIcon, ShieldIcon, LayersIcon, CodeIcon } from "tdesign-icons-react";

export function Settings() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>系统设置</h2>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--td-text-color-placeholder)" }}>管理混天DB实例配置与系统信息</p>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card bordered title="系统信息">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                ["版本", "v1.0.0-enterprise"], ["PG 端口", "5408 (TLS 1.3)"], ["REST 端口", "5000 (HTTPS)"],
                ["存储引擎", "Apache Parquet + Arrow 53"], ["压缩", "Snappy / LZ4 / Zstd"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--td-text-color-placeholder)" }}>{k}</span>
                  <Tag size="small" variant="light" theme="primary">{v}</Tag>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card bordered title="安全配置">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                ["传输加密", "TLS 1.3 + P-521 ECDHE"], ["静态加密", "AES-256-GCM (HKDF)"],
                ["认证方式", "mTLS + SCRAM-SHA-256 + JWT"], ["密钥管理", "HKDF-SHA256 派生"],
                ["访问控制", "RBAC (Admin/Auditor/Writer/Reader)"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--td-text-color-placeholder)" }}>{k}</span>
                  <Tag size="small" variant="light" theme="success">{v}</Tag>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card bordered title="关于">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #667eea, #764ba2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 20 }}>混</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>混天DB Enterprise</div>
                  <div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)" }}>时序安全数据库</div>
                </div>
              </div>
              <Divider style={{ margin: 0 }} />
              {[
                ["作者", "钟智强", <UserIcon />], ["邮箱", "ctkqiang@dingtalk.com", <MailIcon />],
                ["仓库", "gitcode.com/ctkqiang_sr/HunTianDB", <CodeIcon />],
              ].map(([k, v, icon]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                  <span style={{ color: "var(--td-brand-color)" }}>{icon}</span>
                  <span style={{ color: "var(--td-text-color-placeholder)", width: 40 }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
