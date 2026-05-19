import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "tdesign-react";
import I18nProvider from "@/i18n/context";
import App from "@/App";
import { useUIStore, type ThemeMode } from "@/store/uiStore";
import "tdesign-react/es/style/index.css";
import "@/styles/globals.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function ThemedApp() {
  const theme = useUIStore((s) => s.theme);
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const resolve = (m: ThemeMode): "light" | "dark" => {
      if (m === "auto") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      return m;
    };
    const update = () => setResolved(resolve(theme));
    update();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [theme]);

  useEffect(() => { document.documentElement.setAttribute("theme-mode", resolved); }, [resolved]);

  return (
    <ConfigProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemedApp />
    </QueryClientProvider>
  </React.StrictMode>
);
