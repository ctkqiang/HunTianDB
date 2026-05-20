# HunTianDB Frontend

Web console for HunTianDB, built with React + TypeScript + TDesign.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| UI Library | TDesign React |
| Icons | tdesign-icons-react |
| Code Editor | Monaco Editor |
| Charts | Recharts |
| State | Zustand |
| Data Fetching | TanStack Query + Axios |
| i18n | Custom i18n (zh/en) |
| Bundler | Vite |
| Package Manager | Bun |

## Quick Start

```bash
cd frontend
bun install
bun run dev
```

Dev server starts at `http://localhost:3000`.

## Build

```bash
bun run build
```

Output to `dist/`.

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Real-time security event dashboard with KPI cards, throughput area chart, event distribution bar chart, event stream |
| `/events` | EventViewer | Paginated event table with filters |
| `/query` | QueryBuilder | Multi-tab SQL editor with Monaco syntax highlighting, table browser, query history, result export |
| `/settings` | Settings | System info and author information |
| `/login` | LoginPage | Authentication |

## Directory Structure

```
src/
├── api/           # API client (axios instance, event queries)
├── hooks/         # Custom hooks (useEvents, useAuth)
├── i18n/          # Internationalization (zh/en translations, useT hook)
├── layouts/       # Main layout (Header + Aside + Content)
├── pages/         # Page components
│   ├── Dashboard.tsx
│   ├── EventViewer.tsx
│   ├── QueryBuilder.tsx
│   ├── Settings.tsx
│   └── LoginPage.tsx
├── store/         # Zustand stores (filterStore, uiStore, userStore)
├── styles/        # Global styles
└── types/         # TypeScript type definitions
```

## Features

**Dashboard**
- 4 KPI cards (Total Events, System Health, Query Latency, Write Throughput)
- Recharts area chart and bar chart with 4-second auto-refresh
- Event stream feed with click-to-detail Drawer
- One-click demo data generation

**SQL Query Builder**
- Multi-tab Monaco editor with SQL syntax highlighting
- Left sidebar: table browser / query history / sample queries
- Ctrl+Enter to execute
- Export results as CSV / JSON / TXT
- File import with automatic table creation

**Event Viewer**
- Paginated table with row hover highlight
- Filter by event type, zone, user

**Internationalization**
- Chinese / English real-time switching
- Dark / Light theme toggle

## Documentation

| Document | Language |
|----------|----------|
| [README (Chinese)](Readme.md) | ZH |
| [Main README](../README.md) | ZH |
