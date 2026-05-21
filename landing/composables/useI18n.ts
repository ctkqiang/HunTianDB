import { ref, computed } from "vue";
import en from "~/locales/en";
import zh from "~/locales/zh";

type Locale = "en" | "zh";

const currentLocale = ref<Locale>(
  (typeof window !== "undefined" && navigator.language.startsWith("zh")) ? "zh" : "en"
);

const messages = computed(() => (currentLocale.value === "zh" ? zh : en));

export function useI18n() {
  const t = computed(() => messages.value);
  const locale = computed(() => currentLocale.value);

  function setLocale(l: Locale) {
    currentLocale.value = l;
    if (typeof document !== "undefined") {
      document.documentElement.lang = l;
    }
  }

  function toggleLocale() {
    setLocale(currentLocale.value === "zh" ? "en" : "zh");
  }

  return { t, locale, setLocale, toggleLocale };
}
