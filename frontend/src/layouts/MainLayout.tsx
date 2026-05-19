import { type ReactNode } from "react";
import { Layout, Menu, Dropdown, Button, Space, Badge, Avatar, Radio } from "tdesign-react";
import { DashboardIcon, ServerIcon, SearchIcon, SettingIcon, LogoutIcon, UserIcon, MenuFoldIcon, MenuUnfoldIcon, SunnyIcon, MoonIcon } from "tdesign-icons-react";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/context";
import { useUIStore } from "@/store/uiStore";

const { Header, Aside, Content } = Layout;

export function MainLayout({ children }: { children?: ReactNode }) {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useT();
  const { theme, sidebarCollapsed, toggleSidebar, setTheme } = useUIStore();
  const path = window.location.pathname;

  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const menuItems = [
    { value: "/", icon: <DashboardIcon />, content: t("dashboard") },
    { value: "/events", icon: <ServerIcon />, content: t("event_viewer") },
    { value: "/query", icon: <SearchIcon />, content: t("query_builder") },
    { value: "/settings", icon: <SettingIcon />, content: t("settings") },
  ];

  return (
    <Layout style={{ height: "100vh", background: "var(--td-bg-color-page)" }}>
      <Header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 56, borderBottom: "1px solid var(--td-component-stroke)", background: "var(--td-bg-color-container)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Button variant="text" shape="square" icon={sidebarCollapsed ? <MenuUnfoldIcon /> : <MenuFoldIcon />} onClick={toggleSidebar} />
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 15 }}>混</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--td-text-color-primary)" }}>{t("app_name")}</span>
        </div>
        <Space size="small">
          <Button variant="text" shape="square" size="small" icon={theme === "dark" ? <SunnyIcon /> : <MoonIcon />} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} />
          <Radio.Group variant="default-filled" size="small" value={lang} onChange={(v) => setLang(v as "zh" | "en")}>
            <Radio.Button value="zh">中</Radio.Button>
            <Radio.Button value="en">EN</Radio.Button>
          </Radio.Group>
          <Dropdown options={[{ content: t("logout"), value: "logout", prefixIcon: <LogoutIcon /> }]} onClick={({ value }) => { if (value === "logout") signOut(); }}>
            <Space size="small" style={{ cursor: "pointer" }}>
              <Avatar size="small" icon={<UserIcon />} />
              <span style={{ fontSize: 13, color: "var(--td-text-color-primary)" }}>{user?.username || "admin"}</span>
            </Space>
          </Dropdown>
        </Space>
      </Header>
      <Layout>
        <Aside style={{ width: sidebarCollapsed ? 64 : 220, transition: "width 0.2s", borderRight: "1px solid var(--td-component-stroke)", background: "var(--td-bg-color-container)", overflow: "hidden" }}>
          <Menu value={path} onChange={(v) => navigate(v as string)} style={{ marginTop: 8 }} collapsed={sidebarCollapsed}>
            {menuItems.map((item) => (<Menu.MenuItem key={item.value} value={item.value} icon={item.icon}>{item.content}</Menu.MenuItem>))}
          </Menu>
        </Aside>
        <Layout>
          <Content style={{ padding: 24, background: "var(--td-bg-color-page)", overflow: "auto", minHeight: 0 }}>{children}</Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
