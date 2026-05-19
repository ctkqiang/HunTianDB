import { useState } from "react";
import { Layout, Menu, Button, Dropdown, Radio } from "tdesign-react";
import {
  DashboardIcon, ServerIcon, SearchIcon,
  SettingIcon, LogoutIcon, UserIcon, TranslateIcon,
} from "tdesign-icons-react";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/context";

const { Header, Aside, Content } = Layout;

export function MainLayout({ children }: { children?: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useAuth();
  const { t, lang, setLang } = useT();
  const path = window.location.pathname;

  const navigate = (to: string) => {
    window.history.pushState({}, "", to);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const menuItems = [
    { value: "/dashboard", icon: <DashboardIcon />, content: t("dashboard") },
    { value: "/events", icon: <ServerIcon />, content: t("event_viewer") },
    { value: "/query", icon: <SearchIcon />, content: t("query_builder") },
    { value: "/settings", icon: <SettingIcon />, content: t("settings") },
  ];

  return (
    <Layout className="h-screen">
      <Header className="flex items-center justify-between px-6 bg-white border-b">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-purple-600">{t("app_name")}</span>
          <span className="text-sm text-gray-400 hidden sm:inline">{t("app_desc")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Radio.Group
            value={lang}
            onChange={(v) => setLang(v as "zh" | "en")}
            size="small"
            variant="default-filled"
          >
            <Radio.Button value="zh">中文</Radio.Button>
            <Radio.Button value="en">EN</Radio.Button>
          </Radio.Group>
          <Dropdown
            options={[{ content: t("logout"), value: "logout", prefixIcon: <LogoutIcon /> }]}
            onClick={({ value }) => { if (value === "logout") signOut(); }}
          >
            <Button variant="text" icon={<UserIcon />}>
              {user?.username || t("username")}
            </Button>
          </Dropdown>
        </div>
      </Header>

      <Layout>
        <Aside collapsed={collapsed} onCollapseChange={setCollapsed}>
          <Menu value={path} onChange={(v) => navigate(v as string)}>
            {menuItems.map((item) => (
              <Menu.MenuItem key={item.value} value={item.value} icon={item.icon}>
                {item.content}
              </Menu.MenuItem>
            ))}
          </Menu>
        </Aside>
        <Content className="p-6 bg-gray-50 overflow-auto">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
