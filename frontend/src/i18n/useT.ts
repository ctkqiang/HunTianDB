import { createContext, useContext } from "react";
import type { Lang } from "./translations";

export const I18nContext = createContext<{
  lang: Lang;
  t: (key: string) => string;
  setLang: (l: Lang) => void;
}>({ lang: "zh", t: (k) => k, setLang: () => {} });

export function useT() {
  return useContext(I18nContext);
}
