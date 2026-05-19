import { useState } from "react";
import { Input, Button, MessagePlugin, Divider } from "tdesign-react";
import { LockOnIcon, UserIcon, LogoGithubIcon } from "tdesign-icons-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/userStore";
import { useT } from "@/i18n/context";

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
        MessagePlugin.success("开发模式登录成功");
      } else {
        MessagePlugin.error(t("login_failed"));
      }
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: 420, padding: 40 }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 16, boxShadow: "0 8px 32px rgba(102,126,234,0.4)" }}>
            混
          </div>
          <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 700, margin: 0 }}>{t("app_name")}</h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4, letterSpacing: 1 }}>ENTERPRISE SECURITY DATABASE</p>
        </div>

        {/* Card */}
        <div style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", borderRadius: 16, padding: 32, border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ marginBottom: 20 }}>
            <Input
              value={username}
              onChange={(v) => setUsername(v as string)}
              placeholder={t("username")}
              prefixIcon={<UserIcon />}
              size="large"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "#fff" }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <Input
              value={password}
              onChange={(v) => setPassword(v as string)}
              placeholder={t("password")}
              type="password"
              prefixIcon={<LockOnIcon />}
              size="large"
              onEnter={handleLogin}
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "#fff" }}
            />
          </div>

          <Button block size="large" loading={loading} onClick={handleLogin}
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              border: "none", borderRadius: 10, height: 44, fontWeight: 600, fontSize: 15,
              boxShadow: "0 4px 16px rgba(102,126,234,0.3)",
            }}>
            {t("login")}
          </Button>

          <Divider style={{ borderColor: "rgba(255,255,255,0.1)", margin: "20px 0" }} />

          <Button block variant="outline" onClick={() => {
            directLogin({ id: "1", username: "admin", role: "admin", token: "dev-token" });
            MessagePlugin.success("已跳过登录");
          }}
            style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", borderRadius: 10, height: 40 }}>
            演示模式 (跳过登录)
          </Button>

          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 16 }}>
            admin / admin123 &middot; TLS 1.3 + P-521 ECDHE
          </p>
        </div>

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 10, marginTop: 24 }}>
          HunTianDB Enterprise &copy; 2026 钟智强
        </p>
      </div>
    </div>
  );
}
