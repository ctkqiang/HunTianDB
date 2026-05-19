import { useEffect, useState } from "react";
import { LoginPage } from "@/pages/LoginPage";
import { Dashboard } from "@/pages/Dashboard";
import { EventViewer } from "@/pages/EventViewer";
import { QueryBuilder } from "@/pages/QueryBuilder";
import { Settings } from "@/pages/Settings";
import { MainLayout } from "@/layouts/MainLayout";
import { useUserStore } from "@/store/userStore";

export default function App() {
  const isAuth = useUserStore((s) => s.isAuthenticated);
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (!isAuth) return <LoginPage />;

  const page = (() => {
    switch (path) {
      case "/events": return <EventViewer />;
      case "/query": return <QueryBuilder />;
      case "/settings": return <Settings />;
      default: return <Dashboard />;
    }
  })();

  return <MainLayout>{page}</MainLayout>;
}
