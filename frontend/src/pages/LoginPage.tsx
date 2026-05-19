import { useState } from "react";
import { Input, Button, MessagePlugin, Divider } from "tdesign-react";
import { LockOnIcon, UserIcon } from "tdesign-icons-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/userStore";
import { useT } from "@/i18n/useT";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const directLogin = useUserStore((s) => s.login);
  const { t } = useT();

  const handleLogin = async () => {
    if (!username || !password) { MessagePlugin.warning(t("enter_credentials")); return; }
    setLoading(true);
    try {
      await signIn({ username, password });
      MessagePlugin.success(t("login_success"));
    } catch {
      if (username === "admin" && password === "admin123") {
        directLogin({ id: "1", username: "admin", role: "admin", token: "dev-token" });
        MessagePlugin.success(t("login_success"));
      } else {
        MessagePlugin.error(t("login_failed"));
      }
    } finally { setLoading(false); }
  };

  const skip = () => {
    directLogin({ id: "1", username: "admin", role: "admin", token: "dev-token" });
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
    }}>
      <div style={{ width: 400, padding: 36 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 14, boxShadow: "0 8px 28px rgba(124,58,237,0.35)" }}>混</div>
          <h1 style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: 0 }}>{t("app_name")}</h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 4 }}>{t("app_desc")}</p>
        </div>

        <div style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(16px)", borderRadius: 16, padding: 28, border: "1px solid rgba(255,255,255,0.08)" }}>
          <Input value={username} onChange={(v) => setUsername(v as string)} placeholder={t("username") + " (admin)"} prefixIcon={<UserIcon />} size="large" style={{ marginBottom: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#fff" }} />
          <Input value={password} onChange={(v) => setPassword(v as string)} placeholder={t("password") + " (admin123)"} type="password" prefixIcon={<LockOnIcon />} size="large" onEnter={handleLogin} style={{ marginBottom: 22, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#fff" }} />
          <Button block size="large" loading={loading} onClick={handleLogin} style={{ background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)", border: "none", borderRadius: 10, height: 44, fontWeight: 600, fontSize: 15, boxShadow: "0 4px 14px rgba(124,58,237,0.25)" }}>{t("login")}</Button>
          <Divider style={{ borderColor: "rgba(255,255,255,0.08)", margin: "18px 0" }} />
          <Button block variant="outline" onClick={skip} style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", borderRadius: 10, height: 38, fontSize: 13 }}>{t("skip_login")}</Button>
        </div>

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: 10, marginTop: 20 }}>
          HunTianDB v1.0 &copy; 2026 钟智强
        </p>
      </div>
    </div>
  );
}
