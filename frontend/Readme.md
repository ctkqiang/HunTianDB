# 混天DB 前端

混天DB 的 Web 控制台，基于 React + TypeScript + TDesign 构建。

## 技术栈

| 层面 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript |
| UI 组件库 | TDesign React |
| 图标 | tdesign-icons-react |
| 代码编辑器 | Monaco Editor |
| 图表 | Recharts |
| 状态管理 | Zustand |
| 数据请求 | TanStack Query + Axios |
| 国际化 | 自定义 i18n (zh/en) |
| 构建工具 | Vite |
| 包管理 | Bun |

## 快速开始

```bash
cd frontend
bun install
bun run dev
```

开发服务器启动在 `http://localhost:3000`。

## 构建

```bash
bun run build
```

产物输出至 `dist/`。

## 页面结构

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | Dashboard | 实时安全事件仪表板，KPI 卡牌、吞吐量面积图、事件分布柱状图、事件流 |
| `/events` | EventViewer | 分页事件表格，支持筛选 |
| `/query` | QueryBuilder | 多标签页 SQL 编辑器，Monaco 语法高亮、数据表浏览器、查询历史、结果导出 |
| `/settings` | Settings | 系统信息与作者信息 |
| `/login` | LoginPage | 登录认证 |

## 目录结构

```
src/
├── api/           # API 客户端 (axios 实例, 事件查询)
├── hooks/         # 自定义 Hook (useEvents, useAuth)
├── i18n/          # 国际化 (zh/en 翻译, useT hook)
├── layouts/       # 主布局 (Header + Aside + Content)
├── pages/         # 页面组件
│   ├── Dashboard.tsx
│   ├── EventViewer.tsx
│   ├── QueryBuilder.tsx
│   ├── Settings.tsx
│   └── LoginPage.tsx
├── store/         # Zustand 状态 (filterStore, uiStore, userStore)
├── styles/        # 全局样式
└── types/         # TypeScript 类型定义
```

## 特性

**仪表板**
- 4 个 KPI 指标卡（事件写入量、系统健康、查询延迟、写入吞吐量）
- Recharts 面积图与柱状图，4 秒自动刷新
- 事件流 Feed，点击展开详情 Drawer
- 一键生成演示数据

**SQL 查询构建器**
- 多标签页 Monaco 编辑器，SQL 语法高亮
- 左侧边栏：数据表浏览器 / 查询历史 / 示例查询
- Ctrl+Enter 快捷执行
- 结果导出 CSV / JSON / TXT
- 文件导入自动建表

**事件查看器**
- 分页表格，Hover 高亮行
- 按事件类型、分区、用户筛选

**国际化**
- 中文 / English 实时切换
- 深色 / 浅色主题切换

## 文档

| 文档 | 语言 |
|------|------|
| [README (English)](Readme_EN.md) | EN |
| [主 README](../README.md) | ZH |
