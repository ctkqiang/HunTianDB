import { ref, computed } from "vue";
import en from "../locales/en";
import zh from "../locales/zh";

type Locale = "en" | "zh";

// 全局共享状态 — 使用 localStorage 持久化，跨页面保持
const STORAGE_KEY = "huntiandb-lang";

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "zh" || stored === "en") return stored;
  return navigator.language.startsWith("zh") ? "zh" : "en";
}

const currentLocale = ref<Locale>(detectLocale());

const messages = computed(() => (currentLocale.value === "zh" ? zh : en));

export function useI18n() {
  const t = computed(() => messages.value);
  const locale = computed(() => currentLocale.value);

  function setLocale(l: Locale) {
    currentLocale.value = l;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l;
    }
  }

  function toggleLocale() {
    setLocale(currentLocale.value === "zh" ? "en" : "zh");
  }

  return { t, locale, setLocale, toggleLocale };
}
