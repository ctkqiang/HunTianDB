import { Card, Row, Col, Tag, Divider } from "tdesign-react";
import { MailIcon, UserIcon, CodeIcon } from "tdesign-icons-react";
import { useT } from "@/i18n/useT";

export function Settings() {
  const { t } = useT();

  const info = [
    [t("version"), "v1.0.0"], [t("pg_port"), "5409 (TLS 1.3)"], [t("rest_port"), "5001"],
    [t("storage"), "Parquet + Arrow 53"], [t("sql_parser"), "Snappy / LZ4 / Zstd"],
    [t("encryption"), "AES-256-GCM (HKDF-SHA256)"],
  ];

  const sec = [
    ["TLS", "TLS 1.3 + P-521 ECDHE"], ["AES", "AES-256-GCM"],
    [t("security"), "mTLS + SCRAM-SHA-256 + JWT"], ["RBAC", "4 级 (admin/auditor/writer/reader)"],
  ];

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>{t("settings")}</h2>
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
              <img src="/logo.png" alt="HunTianDB" style={{width:40,height:40,borderRadius:8}}/>
              <div><div style={{ fontWeight: 700, fontSize: 15 }}>{t("app_name")}</div><div style={{ fontSize: 11, color: "var(--td-text-color-placeholder)" }}>{t("app_desc")}</div></div>
            </div>
            <Divider style={{ margin: "8px 0" }} />
            {[[t("author"), "钟智强 ctkqiang", <UserIcon />], [t("email"), "ctkqiang@dingtalk.com", <MailIcon />], [t("repo"), "gitcode.com/ctkqiang_sr/HunTianDB", <CodeIcon />]].map(([k, v, i]) => (
              <div key={k as string} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12 }}><span style={{ color: "var(--td-brand-color)" }}>{i as any}</span><span style={{ color: "var(--td-text-color-placeholder)" }}>{k}:</span><span>{v}</span></div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
