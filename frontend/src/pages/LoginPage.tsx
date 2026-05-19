import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Input, Button, MessagePlugin } from "tdesign-react";
import { LockOnIcon, UserIcon } from "tdesign-icons-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthLayout } from "@/layouts/AuthLayout";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!username || !password) {
      MessagePlugin.warning("请输入用户名和密码");
      return;
    }
    setLoading(true);
    try {
      await signIn({ username, password });
      MessagePlugin.success("登录成功");
      navigate({ to: "/dashboard" });
    } catch {
      MessagePlugin.error("登录失败，请检查用户名和密码");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="space-y-4">
        <Input
          value={username}
          onChange={(v) => setUsername(v as string)}
          placeholder="用户名"
          prefixIcon={<UserIcon />}
          size="large"
        />
        <Input
          value={password}
          onChange={(v) => setPassword(v as string)}
          placeholder="密码"
          type="password"
          prefixIcon={<LockOnIcon />}
          size="large"
          onEnter={handleLogin}
        />
        <Button
          block
          size="large"
          theme="primary"
          loading={loading}
          onClick={handleLogin}
        >
          登录
        </Button>
      </div>
    </AuthLayout>
  );
}
