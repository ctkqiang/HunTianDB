export default defineNuxtConfig({
  compatibilityDate: "2026-05-21",
  devtools: { enabled: false },
  css: ["~/assets/css/main.css"],
  devServer: { port: 8000 },
  app: {
    head: {
      title: "HunTianDB — Timeseries Security Database",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "description", content: "HunTianDB is a high-performance timeseries security database with PostgreSQL wire protocol compatibility. Built in Rust." },
        { property: "og:title", content: "HunTianDB" },
        { property: "og:description", content: "Timeseries Security Database — PG Wire Protocol Compatible" },
      ],
      link: [
        { rel: "icon", href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='28' font-size='28'>混</text></svg>" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" },
      ],
    },
  },
});
