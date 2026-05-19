import { useState, useCallback, type ReactNode } from "react";
import { translations } from "./translations";
import { I18nContext } from "./useT";
import type { Lang } from "./translations";

export default function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(
    () => (navigator.language.startsWith("zh") ? "zh" : "en") as Lang
  );
  const t = useCallback((key: string) => translations[lang][key] || key, [lang]);
  return <I18nContext.Provider value={{ lang, t, setLang }}>{children}</I18nContext.Provider>;
}
