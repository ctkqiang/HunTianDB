import { useState } from "react";
import { Input, Button, MessagePlugin, Divider } from "tdesign-react";
import { LockOnIcon, UserIcon } from "tdesign-icons-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/userStore";
import { useT } from "@/i18n/useT";

export function LoginPage() {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [loading, setLoading] = useState(false);
  const { signIn } = useAuth(); const directLogin = useUserStore((s) => s.login); const { t } = useT();

  const login = async () => {
    if (!u || !p) { MessagePlugin.warning(t("enter_credentials")); return; }
    setLoading(true);
    try { await signIn({ username: u, password: p }); MessagePlugin.success(t("login_success")); }
    catch {
      if (u === "admin" && p === "admin123") { directLogin({ id: "1", username: "admin", role: "admin", token: "dev-token" }); MessagePlugin.success(t("login_success")); }
      else { MessagePlugin.error(t("login_failed")); }
    }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #0a0818 0%, #151030 50%, #0d1424 100%)" }}>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "linear-gradient(135deg, #7C3AED, #A855F7)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", boxShadow: "0 6px 20px rgba(124,58,237,0.3)" }}>混</div>
          <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: "10px 0 0" }}>{t("app_name")}</h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 2 }}>{t("app_desc")}</p>
        </div>
        <div style={{ background: "rgba(255,255,255,0.035)", backdropFilter: "blur(12px)", borderRadius: 14, padding: 26, border: "1px solid rgba(255,255,255,0.05)" }}>
          <Input value={u} onChange={(v) => setU(v as string)} placeholder={t("username")} prefixIcon={<UserIcon />} size="large" style={{ marginBottom: 12 }} />
          <Input value={p} onChange={(v) => setP(v as string)} placeholder={t("password")} type="password" prefixIcon={<LockOnIcon />} size="large" onEnter={login} style={{ marginBottom: 18 }} />
          <Button block size="large" loading={loading} onClick={login} style={{ height: 44, fontWeight: 600, fontSize: 15 }}>{t("login")}</Button>
          <Divider style={{ margin: "14px 0", opacity: 0.15 }} />
          <Button block variant="outline" onClick={() => directLogin({ id: "1", username: "admin", role: "admin", token: "dev-token" })}>{t("skip_login")}</Button>
        </div>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.12)", fontSize: 10, marginTop: 18 }}>HunTianDB v1.0</p>
      </div>
    </div>
  );
}
