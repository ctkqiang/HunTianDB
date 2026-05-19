import { type ReactNode } from "react";
import { Layout, Menu, Dropdown, Button, Space, Avatar, Radio } from "tdesign-react";
import { DashboardIcon, ServerIcon, SearchIcon, SettingIcon, LogoutIcon, UserIcon, MenuFoldIcon, MenuUnfoldIcon, SunnyIcon, MoonIcon } from "tdesign-icons-react";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/useT";
import { useUIStore } from "@/store/uiStore";

const { Header, Aside, Content } = Layout;

export function MainLayout({ children }: { children?: ReactNode }) {
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useT();
  const { theme, sidebarCollapsed, toggleSidebar, setTheme } = useUIStore();
  const nav = (to: string) => { window.history.pushState({}, "", to); window.dispatchEvent(new PopStateEvent("popstate")); };

  const items = [
    { value: "/", icon: <DashboardIcon />, content: t("dashboard") },
    { value: "/events", icon: <ServerIcon />, content: t("event_viewer") },
    { value: "/query", icon: <SearchIcon />, content: t("query_builder") },
    { value: "/settings", icon: <SettingIcon />, content: t("settings") },
  ];

  return (
    <Layout style={{ height: "100vh" }}>
      <Header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 52, borderBottom: "1px solid var(--td-component-stroke)", background: "var(--td-bg-color-container)", flexShrink: 0 }}>
        <Space size={12}>
          <Button variant="text" shape="square" size="small" icon={sidebarCollapsed ? <MenuUnfoldIcon /> : <MenuFoldIcon />} onClick={toggleSidebar} />
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--td-brand-color)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 13 }}>混</div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t("app_name")}</span>
        </Space>
        <Space size={8}>
          <Button variant="text" shape="square" size="small" icon={theme === "dark" ? <SunnyIcon /> : <MoonIcon />} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} />
          <Radio.Group variant="default-filled" size="small" value={lang} onChange={(v) => setLang(v as "zh" | "en")}><Radio.Button value="zh">中</Radio.Button><Radio.Button value="en">EN</Radio.Button></Radio.Group>
          <Dropdown options={[{ content: t("logout"), value: "logout", prefixIcon: <LogoutIcon /> }]} onClick={({ value }) => { if (value === "logout") signOut(); }}>
            <Space size={6} style={{ cursor: "pointer" }}><Avatar size="small" icon={<UserIcon />} /><span style={{ fontSize: 13 }}>{user?.username ?? "admin"}</span></Space>
          </Dropdown>
        </Space>
      </Header>
      <Layout style={{ flex: 1, minHeight: 0 }}>
        <Aside style={{ width: sidebarCollapsed ? 64 : 220, transition: "width .2s", borderRight: "1px solid var(--td-component-stroke)", background: "var(--td-bg-color-container)", flexShrink: 0 }}>
          <Menu value={window.location.pathname} collapsed={sidebarCollapsed} onChange={(v) => nav(v as string)} style={{ marginTop: 4 }}>
            {items.map((i) => <Menu.MenuItem key={i.value} value={i.value} icon={i.icon}>{i.content}</Menu.MenuItem>)}
          </Menu>
        </Aside>
        <Content style={{ padding: 20, background: "var(--td-bg-color-page)", overflow: "auto", flex: 1 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
