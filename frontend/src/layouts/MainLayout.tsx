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
  const path = window.location.pathname;
  const nav = (to: string) => { window.history.pushState({}, "", to); window.dispatchEvent(new PopStateEvent("popstate")); };

  return (
    <Layout style={{ height: "100vh" }}>

      {/* ---- HEADER ---- */}
      <Header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 10px", height: 60,
        borderBottom: "1px solid var(--td-component-stroke)",
        background: "var(--td-bg-color-container)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg, #7C3AED, #A855F7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 15 }}>混</div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t("app_name")}</span>
        </div>

        <Space size={4}>
          <Dropdown options={[
            {content:theme==="dark"?"浅色模式":"深色模式",value:"theme",prefixIcon:theme==="dark"?<SunnyIcon/>:<MoonIcon/>},
            {content:lang==="zh"?"Switch to English":"切换到中文",value:"lang",prefixIcon:lang==="zh"?<MoonIcon/>:<SunnyIcon/>},
            {content:"—",value:"divider",divider:true},
            {content:t("logout"),value:"logout",prefixIcon:<LogoutIcon/>},
          ]} onClick={({value})=>{
            if(value==="theme")setTheme(theme==="dark"?"light":"dark");
            if(value==="lang")setLang(lang==="zh"?"en":"zh");
            if(value==="logout")signOut();
          }}>
            <Space size={6} style={{cursor:"pointer",padding:"0 4px"}}>
              <Avatar size="small" icon={<UserIcon/>}/>
              <span style={{fontSize:13}}>{user?.username??"admin"}</span>
            </Space>
          </Dropdown>
        </Space>
      </Header>

      {/* ---- BODY ---- */}
      <Layout style={{flex:1,minHeight:0}}>
        <Aside style={{
          width: sidebarCollapsed?64:220, transition:"width .2s",
          borderRight: "1px solid var(--td-component-stroke)",
          background: "var(--td-bg-color-container)", flexShrink: 0,
          display: "flex", flexDirection: "column",
        }}>
        
          <Menu value={path} collapsed={sidebarCollapsed} onChange={v=>nav(v as string)} style={{flex:1}}>
            {[
              ["/",<DashboardIcon/>,t("dashboard")],
              ["/events",<ServerIcon/>,t("event_viewer")],
              ["/query",<SearchIcon/>,t("query_builder")],
              ["/settings",<SettingIcon/>,t("settings")],
            ].map(([v,icon,label])=>(<Menu.MenuItem key={v as string} value={v as string} icon={icon as any}>{label as string}</Menu.MenuItem>))}
          </Menu>
          {!sidebarCollapsed&&<div style={{padding:"8px 16px",fontSize:10,color:"var(--td-text-color-placeholder)",borderTop:"1px solid var(--td-component-stroke)"}}>HunTianDB v1.0 · TLS 1.3</div>}
        </Aside>

        <Content style={{padding:"28px 24px 24px",overflow:"auto",flex:1,background:"var(--td-bg-color-page)"}}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
