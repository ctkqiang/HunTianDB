import { type ReactNode } from "react";
import { Layout, Menu, Dropdown, Button, Space, Avatar, Radio } from "tdesign-react";
import { DashboardIcon, ServerIcon, SearchIcon, SettingIcon, LogoutIcon, UserIcon, MenuFoldIcon, MenuUnfoldIcon, SunnyIcon, MoonIcon, TranslateIcon } from "tdesign-icons-react";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/useT";
import { useUIStore } from "@/store/uiStore";

const { Header, Aside, Content } = Layout;

/**
 * 混天DB 企业级主布局框架。
 *
 * 采用 TDesign Layout 组件构建经典的「Header-Aside-Content」三栏结构。
 * Header 承载品牌标识、主题切换、语言切换与用户下拉菜单；
 * Aside 提供可折叠的侧边导航栏（仪表板/事件查看/查询构建器/设置）；
 * Content 区域渲染子路由页面。
 *
 * 主题状态由 `useUIStore` 全局管理，支持深色/浅色双模切换。
 * 语言状态由 `useT` 国际化 Hook 驱动，支持中文/英文实时切换。
 *
 * @param children 子组件（页面内容），由路由分发器注入。
 * @returns 完整的 TDesign 企业级布局 JSX 元素。
 *
 * @example
 * ```tsx
 * <MainLayout>
 *   <Dashboard />
 * </MainLayout>
 * ```
 */
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
          <img src="/logo.png" alt="HunTianDB" style={{width:32,height:32,borderRadius:8,flexShrink:0}}/>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{t("app_name")}</span>
        </div>

        <Space size={4}>
          <Dropdown options={[
            {content:theme==="dark"?"浅色模式":"深色模式",value:"theme",prefixIcon:theme==="dark"?<MoonIcon/>:<SunnyIcon/>},
            {content:lang==="zh"?"Switch to English":"切换到中文",value:"lang",prefixIcon:<TranslateIcon/>},
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
