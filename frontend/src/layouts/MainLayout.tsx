import { type ReactNode } from "react";
import { Layout, Menu, Dropdown, Button, Space, Badge, Avatar, Radio } from "tdesign-react";
import { DashboardIcon, ServerIcon, SearchIcon, SettingIcon, LogoutIcon, UserIcon, NotificationIcon, MenuFoldIcon, MenuUnfoldIcon, SunnyIcon, MoonIcon } from "tdesign-icons-react";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/context";
import { useUIStore, type ThemeMode } from "@/store/uiStore";

const { Header, Aside, Content, Footer } = Layout;

export function MainLayout({ children }: { children?: ReactNode }) {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useT();
  const { theme, sidebarCollapsed, setTheme, toggleSidebar } = useUIStore();
  const path = window.location.pathname;

  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const cycleTheme = () => {
    const order: ThemeMode[] = ["light", "dark", "auto"];
    setTheme(order[(order.indexOf(theme) + 1) % order.length]);
  };
  const themeIcon = theme === "dark" ? <MoonIcon /> : <SunnyIcon />;
  const themeLabel: Record<ThemeMode, string> = { light: "浅色", dark: "深色", auto: "自动" };

  const menuItems = [
    { value: "/", icon: <DashboardIcon />, content: t("dashboard") },
    { value: "/events", icon: <ServerIcon />, content: t("event_viewer") },
    { value: "/query", icon: <SearchIcon />, content: t("query_builder") },
    { value: "/settings", icon: <SettingIcon />, content: t("settings") },
  ];

  return (
    <Layout style={{ height: "100vh" }}>
      <Header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid var(--td-component-stroke)", background: "var(--td-bg-color-container)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Button variant="text" shape="square" icon={sidebarCollapsed ? <MenuUnfoldIcon /> : <MenuFoldIcon />} onClick={toggleSidebar} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16 }}>混</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>{t("app_name")}</div>
              <div style={{ fontSize: 10, color: "var(--td-text-color-placeholder)", lineHeight: 1.2, letterSpacing: 0.5 }}>ENTERPRISE</div>
            </div>
          </div>
        </div>
        <Space size="medium">
          <Button variant="text" shape="square" icon={themeIcon} onClick={cycleTheme} title={themeLabel[theme]} />
          <Radio.Group variant="default-filled" size="small" value={lang} onChange={(v) => setLang(v as "zh" | "en")}>
            <Radio.Button value="zh">中</Radio.Button>
            <Radio.Button value="en">EN</Radio.Button>
          </Radio.Group>
          <Badge count={0}><Button variant="text" shape="square" icon={<NotificationIcon />} /></Badge>
          <Dropdown options={[{ content: t("logout"), value: "logout", prefixIcon: <LogoutIcon />, theme: "error" as const }]} onClick={({ value }) => { if (value === "logout") signOut(); }}>
            <Space size="small" style={{ cursor: "pointer" }}>
              <Avatar size="small" icon={<UserIcon />} />
              <span style={{ fontSize: 13 }}>{user?.username || "admin"}</span>
            </Space>
          </Dropdown>
        </Space>
      </Header>
      <Layout>
        <Aside collapsed={sidebarCollapsed} style={{ borderRight: "1px solid var(--td-component-stroke)", background: "var(--td-bg-color-container)" }}>
          <Menu value={path} onChange={(v) => navigate(v as string)} style={{ marginTop: 8 }}>
            {menuItems.map((item) => (
              <Menu.MenuItem key={item.value} value={item.value} icon={item.icon}>{item.content}</Menu.MenuItem>
            ))}
          </Menu>
        </Aside>
        <Layout>
          <Content style={{ padding: 24, background: "var(--td-bg-color-page)", overflow: "auto" }}>{children}</Content>
          <Footer style={{ textAlign: "center", fontSize: 11, color: "var(--td-text-color-placeholder)", padding: "6px 24px", borderTop: "1px solid var(--td-component-stroke)" }}>
            HunTianDB Enterprise v1.0.0 &copy; 2026 钟智强 &middot; TLS 1.3 + P-521 ECDHE + AES-256-GCM
          </Footer>
        </Layout>
      </Layout>
    </Layout>
  );
}
