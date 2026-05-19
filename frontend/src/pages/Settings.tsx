import { Card, Row, Col, Tag, Divider } from "tdesign-react";
import { MailIcon, UserIcon, CodeIcon } from "tdesign-icons-react";
import { useT } from "@/i18n/useT";

export function Settings() {
  const { t } = useT();

  const info = [
    ["版本", "v1.0.0"], ["PG 端口", "5409 (TLS 1.3)"], ["REST 端口", "5001"],
    ["存储", "Parquet + Arrow 53"], ["压缩", "Snappy / LZ4 / Zstd"],
    ["加密", "AES-256-GCM (HKDF-SHA256)"],
  ];

  const sec = [
    ["传输", "TLS 1.3 + P-521 ECDHE"], ["静态", "AES-256-GCM"],
    ["认证", "mTLS + SCRAM-SHA-256 + JWT"], ["授权", "RBAC 4级"],
  ];

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>{t("settings")}</h2>
      <Row gutter={16}>
        <Col span={8}>
          <Card bordered title={t("system_info")}>
            {info.map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid var(--td-component-stroke)" }}><span style={{ color: "var(--td-text-color-placeholder)" }}>{k}</span><span>{v}</span></div>)}
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered title={t("security_config")}>
            {sec.map(([k, v]) => <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid var(--td-component-stroke)" }}><span style={{ color: "var(--td-text-color-placeholder)" }}>{k}</span><Tag size="small" variant="light" theme="success">{v}</Tag></div>)}
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered title={t("about")}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--td-brand-color)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18 }}>混</div>
              <div><div style={{ fontWeight: 700, fontSize: 15 }}>{t("app_name")}</div><div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)" }}>{t("app_desc")}</div></div>
            </div>
            <Divider style={{ margin: "8px 0" }} />
            {[["作者", "钟智强", <UserIcon />], ["邮箱", "ctkqiang@dingtalk.com", <MailIcon />], ["仓库", "gitcode.com/ctkqiang_sr/HunTianDB", <CodeIcon />]].map(([k, v, i]) => (
              <div key={k as string} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12 }}><span style={{ color: "var(--td-brand-color)" }}>{i as any}</span><span style={{ color: "var(--td-text-color-placeholder)" }}>{k}:</span><span>{v}</span></div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
