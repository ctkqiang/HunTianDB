import { useState } from "react";
import { Input, Button, MessagePlugin, Divider } from "tdesign-react";
import { LockOnIcon, UserIcon } from "tdesign-icons-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/userStore";
import { AuthLayout } from "@/layouts/AuthLayout";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const directLogin = useUserStore((s) => s.login);

  const handleLogin = async () => {
    if (!username || !password) {
      MessagePlugin.warning("请输入用户名和密码");
      return;
    }
    setLoading(true);
    try {
      await signIn({ username, password });
      MessagePlugin.success("登录成功");
    } catch {
      // 后端不可用时降级为本地登录
      if (username === "admin" && password === "admin123") {
        directLogin({ id: "1", username: "admin", role: "admin", token: "dev-token" });
        MessagePlugin.success("开发模式登录成功");
      } else {
        MessagePlugin.error("登录失败 — 后端未连接或密码错误");
      }
    } finally {
      setLoading(false);
    }
  };

  const skipLogin = () => {
    directLogin({ id: "1", username: "admin", role: "admin", token: "dev-token" });
    MessagePlugin.success("已跳过登录 (开发模式)");
  };

  return (
    <AuthLayout>
      <div className="space-y-4">
        <Input
          value={username}
          onChange={(v) => setUsername(v as string)}
          placeholder="用户名 (admin)"
          prefixIcon={<UserIcon />}
          size="large"
        />
        <Input
          value={password}
          onChange={(v) => setPassword(v as string)}
          placeholder="密码 (admin123)"
          type="password"
          prefixIcon={<LockOnIcon />}
          size="large"
          onEnter={handleLogin}
        />
        <Button block size="large" theme="primary" loading={loading} onClick={handleLogin}>
          登录
        </Button>
        <Divider />
        <Button block variant="outline" onClick={skipLogin}>
          跳过登录 (演示模式)
        </Button>
        <p className="text-xs text-gray-400 text-center">
          默认账号: admin / admin123
        </p>
      </div>
    </AuthLayout>
  );
}
