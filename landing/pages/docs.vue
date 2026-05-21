<template>
  <div class="docs-layout">
    <!-- Sidebar -->
    <aside class="docs-sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <a href="/" class="sidebar-logo">
          <img src="/logo.png" alt="HunTianDB" width="28" height="28" />
          <span>HunTian<span class="accent">DB</span> Docs</span>
        </a>
        <button class="docs-lang-btn" @click="setLocale(locale === 'zh' ? 'en' : 'zh')">
          <Globe :size="13" /> {{ locale === 'zh' ? 'EN' : '中文' }}
        </button>
      </div>
      <nav class="sidebar-nav">
        <div v-for="section in t.sections" :key="section.id" class="nav-section">
          <button class="nav-section-title" @click="toggleSection(section.id)" :class="{ active: section.id === activeSection }">
            <ChevronRight :size="14" class="chevron" :class="{ rotated: openSections.has(section.id) }" />
            {{ section.title }}
          </button>
          <div v-if="openSections.has(section.id)" class="nav-items">
            <a v-for="item in section.items" :key="item.id"
              :href="'#' + item.id"
              :class="{ active: currentHash === item.id }"
              @click="selectItem(item.id, section.id)">{{ item.title }}</a>
          </div>
        </div>
      </nav>
    </aside>

    <!-- Mobile toggle -->
    <button class="sidebar-toggle" @click="sidebarOpen = !sidebarOpen"><Menu :size="20" /></button>

    <!-- Content -->
    <main class="docs-content" @click="sidebarOpen = false">
      <div class="docs-inner" v-html="currentContent" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { ChevronRight, Menu, Globe } from "lucide-vue-next";
import docsEn from "../locales/docs-en";
import docsZh from "../locales/docs-zh";

// useI18n 在 Nuxt composables 中自动导入，跨页面状态共享
const { locale, setLocale } = useI18n();
const t = computed(() => locale.value === "zh" ? docsZh : docsEn);

const sidebarOpen = ref(false);
const currentHash = ref("overview");
const activeSection = ref("getting-started");
const openSections = ref(new Set(["getting-started"]));

const allItems = computed(() => t.value.sections.flatMap(s => s.items));
const currentContent = computed(() => allItems.value.find(i => i.id === currentHash.value)?.content || "");

function toggleSection(id: string) {
  if (openSections.value.has(id)) openSections.value.delete(id);
  else openSections.value.add(id);
  openSections.value = new Set(openSections.value);
  activeSection.value = id;
}

function selectItem(itemId: string, sectionId: string) {
  currentHash.value = itemId;
  activeSection.value = sectionId;
  openSections.value.add(sectionId);
  openSections.value = new Set(openSections.value);
  sidebarOpen.value = false;
}

function onHashChange() {
  const h = window.location.hash.slice(1);
  if (h) {
    currentHash.value = h;
    for (const s of t.value.sections) {
      if (s.items.some(i => i.id === h)) {
        openSections.value.add(s.id);
        activeSection.value = s.id;
        break;
      }
    }
    openSections.value = new Set(openSections.value);
  }
}

// ── Syntax highlighting ──
const SQL_KEYWORDS = ["SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "CREATE", "TABLE", "DROP", "ALTER", "DESCRIBE", "SHOW", "COLUMNS", "TABLES", "USERS", "ORDER", "BY", "GROUP", "LIMIT", "DESC", "ASC", "AND", "OR", "NOT", "NULL", "SET", "COUNT", "SUM", "AVG", "MIN", "MAX", "AS", "ON", "LEFT", "RIGHT", "JOIN", "INNER", "PRIMARY", "KEY", "BETWEEN", "IN", "LIKE", "DEFAULT", "TRUE", "FALSE", "EXISTS", "HAVING", "OFFSET", "CAST", "CASE", "WHEN", "THEN", "ELSE", "END", "DISTINCT", "ALL", "UNION", "EXCEPT", "INTERSECT", "IF", "BEGIN", "COMMIT", "ROLLBACK", "GRANT", "REVOKE", "TO", "WITH", "INDEX", "VIEW", "FUNCTION", "RETURNS", "LANGUAGE", "DECLARE", "CURSOR", "FETCH", "CLOSE", "OPEN", "FOR", "LOOP", "WHILE", "RETURN", "EXECUTE", "PREPARE", "DEALLOCATE"];
const SQL_FUNCTIONS = ["COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF", "CAST", "LOWER", "UPPER", "TRIM", "LENGTH", "SUBSTRING", "REPLACE", "CONCAT", "NOW", "CURRENT_TIMESTAMP", "EXTRACT", "DATE_TRUNC", "STRING_AGG", "ARRAY_AGG", "ROW_NUMBER", "RANK", "DENSE_RANK", "LAG", "LEAD", "FIRST_VALUE", "LAST_VALUE"];
const LANG_KEYWORDS: Record<string, string[]> = {
  python: ["import", "from", "def", "class", "return", "if", "else", "elif", "for", "while", "try", "except", "with", "as", "in", "not", "and", "or", "True", "False", "None", "print", "yield", "raise", "pass", "break", "continue", "lambda", "async", "await"],
  go: ["func", "import", "package", "return", "if", "else", "for", "range", "var", "const", "type", "struct", "interface", "map", "chan", "defer", "go", "select", "case", "switch", "break", "continue", "nil", "true", "false", "string", "int", "bool", "error"],
  rust: ["fn", "let", "mut", "use", "pub", "mod", "struct", "enum", "impl", "trait", "type", "where", "for", "while", "loop", "if", "else", "match", "return", "self", "Self", "async", "await", "move", "ref", "static", "const", "crate", "super", "unsafe", "extern", "true", "false"],
  javascript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "try", "catch", "import", "export", "default", "from", "async", "await", "class", "new", "this", "true", "false", "null", "undefined", "typeof", "instanceof"],
  java: ["public", "private", "protected", "class", "interface", "extends", "implements", "static", "final", "void", "int", "String", "boolean", "return", "if", "else", "for", "while", "try", "catch", "throw", "throws", "new", "this", "super", "import", "package", "null", "true", "false"],
  c: ["include", "define", "ifdef", "ifndef", "endif", "typedef", "struct", "enum", "union", "void", "int", "char", "double", "float", "long", "short", "unsigned", "signed", "const", "static", "extern", "return", "if", "else", "for", "while", "sizeof", "NULL", "true", "false"],
  php: ["function", "return", "if", "else", "for", "foreach", "while", "class", "public", "private", "protected", "static", "new", "echo", "require", "include", "use", "namespace", "try", "catch", "throw", "null", "true", "false", "array"],
  ruby: ["def", "end", "class", "module", "require", "include", "extend", "if", "else", "elsif", "unless", "while", "for", "do", "begin", "rescue", "ensure", "return", "yield", "self", "nil", "true", "false", "attr_accessor", "attr_reader"],
  erlang: ["module", "export", "import", "define", "record", "if", "case", "of", "end", "when", "receive", "after", "catch", "try", "fun", "let", "spawn", "send", "self", "true", "false", "ok", "error"],
  haskell: ["import", "module", "where", "let", "in", "data", "type", "class", "instance", "deriving", "do", "case", "of", "if", "then", "else", "qualified", "as", "hiding", "newtype", "infixl", "infixr"],
  bash: [],
};
const LANG_TYPES = ["BIGINT", "INT", "SMALLINT", "VARCHAR", "TEXT", "BOOLEAN", "FLOAT", "DOUBLE", "TIMESTAMP", "DATE", "BYTEA", "OID", "XID", "NAME", "BOOL", "INT2", "INT4", "INT8", "FLOAT4", "FLOAT8", "CHAR", "REGPROC", "TEXT[]", "OID[]", "ANY", "VOID"];

function highlightBlock(el: HTMLElement) {
  const codeEl = el.querySelector("code");
  if (!codeEl || codeEl.querySelector(".tok-kw")) return; // already highlighted
  const lang = el.getAttribute("data-lang") || "";
  let html = codeEl.innerHTML;

  // String literals
  html = html.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g, '<span class="tok-str">$&</span>');
  // Numbers
  html = html.replace(/\b(\d+\.?\d*)\b/g, '<span class="tok-num">$1</span>');
  // Comments: -- to end of line, # to end of line, // to end of line
  html = html.replace(/(--.*$|#.*$|\/\/.*$)/gm, '<span class="tok-comment">$1</span>');
  // SQL keywords (case insensitive)
  for (const kw of SQL_KEYWORDS) {
    const re = new RegExp(`\\b(${kw})\\b`, "gi");
    html = html.replace(re, '<span class="tok-kw">$1</span>');
  }
  // SQL functions
  for (const fn of SQL_FUNCTIONS) {
    const re = new RegExp(`\\b(${fn})\\b(?=\\s*\\()`, "gi");
    html = html.replace(re, '<span class="tok-fn">$1</span>');
  }
  // Language-specific keywords
  if (lang && LANG_KEYWORDS[lang]) {
    for (const kw of LANG_KEYWORDS[lang]) {
      const re = new RegExp(`\\b(${kw})\\b`, "g");
      html = html.replace(re, '<span class="tok-kw">$1</span>');
    }
  }
  // SQL types
  for (const t of LANG_TYPES) {
    const re = new RegExp(`\\b(${t})\\b`, "gi");
    html = html.replace(re, '<span class="tok-type">$1</span>');
  }
  // Flags (--flag, -f style)
  html = html.replace(/(\s|^)(--?[a-zA-Z][a-zA-Z0-9_-]*)/g, '$1<span class="tok-flag">$2</span>');
  // Docker commands
  html = html.replace(/\b(docker|pull|push|run|build|exec|ps|logs|stop|start|restart|rm|rmi|tag|login|logout|compose)\b/g, '<span class="tok-cmd">$1</span>');

  codeEl.innerHTML = html;
}

function highlightAllCode() {
  nextTick(() => {
    document.querySelectorAll(".docs-inner pre").forEach(el => highlightBlock(el as HTMLElement));
  });
}

watch(currentContent, () => highlightAllCode());
onMounted(() => { onHashChange(); highlightAllCode(); window.addEventListener("hashchange", onHashChange); });
onUnmounted(() => window.removeEventListener("hashchange", onHashChange));
</script>

<style>
/* ═══ DOCS LAYOUT ═══ */
.docs-layout { display: flex; min-height: 100vh; background: #0b0b16; color: #e4e4ec; font-family: "Inter", system-ui, sans-serif; }
.accent { color: #e63946; }

/* ── SIDEBAR ── */
.docs-sidebar { width: 280px; min-width: 280px; height: 100vh; position: sticky; top: 0; overflow-y: auto; background: #0d0d1a; border-right: 1px solid rgba(255,255,255,0.06); padding: 0 0 24px; z-index: 30; }
.sidebar-header { padding: 20px 20px 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.sidebar-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; color: #fff; font-weight: 700; font-size: 15px; }
.docs-lang-btn { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #aaa; cursor: pointer; padding: 4px 8px; font-size: 10px; display: flex; align-items: center; gap: 4px; transition: all 0.2s; font-family: inherit; }
.docs-lang-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
.sidebar-nav { padding: 0 10px; }
.nav-section { margin-bottom: 2px; }
.nav-section-title { display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 10px; background: none; border: none; color: #bbb; font-size: 13px; font-weight: 600; cursor: pointer; text-align: left; border-radius: 6px; transition: all 0.15s; font-family: inherit; }
.nav-section-title:hover { background: rgba(255,255,255,0.03); color: #fff; }
.nav-section-title.active { color: #e63946; }
.chevron { transition: transform 0.2s; opacity: 0.5; flex-shrink: 0; }
.chevron.rotated { transform: rotate(90deg); opacity: 0.8; }
.nav-items { padding: 2px 0 2px 22px; display: flex; flex-direction: column; gap: 1px; }
.nav-items a { display: block; padding: 6px 10px; color: #8a8a9a; text-decoration: none; font-size: 12.5px; border-radius: 5px; transition: all 0.15s; }
.nav-items a:hover { color: #e0e0e0; background: rgba(255,255,255,0.02); }
.nav-items a.active { color: #e63946; background: rgba(230,57,70,0.08); font-weight: 600; }

/* ── CONTENT ── */
.docs-content { flex: 1; min-width: 0; padding: 40px 48px 80px; max-width: 860px; }
.docs-inner { animation: fadeIn 0.3s ease; }
.docs-inner h2 { font-size: 28px; font-weight: 800; margin: 0 0 16px; color: #fff; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.docs-inner h3 { font-size: 18px; font-weight: 700; margin: 32px 0 10px; color: #e0e0e0; }
.docs-inner h4 { font-size: 14px; font-weight: 600; margin: 16px 0 6px; color: #bbb; }
.docs-inner p { font-size: 14px; line-height: 1.75; color: #bbb; margin: 0 0 12px; }
.docs-inner strong { color: #fff; font-weight: 600; }
.docs-inner code { font-family: "JetBrains Mono", monospace; background: rgba(255,97,136,0.12); padding: 2px 7px; border-radius: 4px; font-size: 13px; color: #ff6188; border: 1px solid rgba(255,97,136,0.15); }
.docs-inner pre { background: #12121f; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 18px 22px; overflow-x: auto; margin: 14px 0; max-height: none !important; }
.docs-inner pre code { background: none; padding: 0; color: #f8f8f2; font-size: 13px; line-height: 1.7; display: block; white-space: pre; border: none; }
.docs-inner ol, .docs-inner ul { padding-left: 20px; margin: 8px 0 16px; font-size: 14px; color: #bbb; line-height: 1.7; }
.docs-inner li { margin-bottom: 4px; }
.docs-inner li::marker { color: #ff6188; }
.docs-inner table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px; border-radius: 8px; overflow: hidden; }
.docs-inner th { text-align: left; padding: 10px 14px; font-weight: 600; color: #ffd866; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(255,97,136,0.06); }
.docs-inner tr:hover td { background: rgba(255,97,136,0.03); }
.docs-inner td { padding: 10px 14px; color: #ccc; border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; }
.docs-inner td code { color: #a9dc76; background: rgba(169,220,118,0.1); border-color: rgba(169,220,118,0.15); }
.docs-inner .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 16px 0; }
.docs-inner .info-card { background: #12121f; border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 16px; }
.docs-inner .info-card strong { display: block; font-size: 13px; margin-bottom: 4px; }
.docs-inner .info-card span { font-size: 12px; color: #8a8a9a; line-height: 1.5; }

/* ── MOBILE ── */
.sidebar-toggle { display: none; position: fixed; top: 12px; left: 12px; z-index: 40; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #fff; padding: 8px 10px; cursor: pointer; }
@media (max-width: 860px) {
  .docs-sidebar { position: fixed; left: -290px; transition: left 0.3s; }
  .docs-sidebar.open { left: 0; box-shadow: 8px 0 40px rgba(0,0,0,0.6); }
  .sidebar-toggle { display: block; }
  .docs-content { padding: 24px 20px 60px; }
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* ── SYNTAX HIGHLIGHTING (Vibrant) ── */
.tok-kw { color: #ff6188; font-weight: 700; }
.tok-fn { color: #a9dc76; font-weight: 600; }
.tok-str { color: #ffd866; }
.tok-num { color: #ab9df2; }
.tok-flag { color: #ab9df2; }
.tok-cmd { color: #78dce8; font-weight: 700; }
.tok-type { color: #fc9867; font-weight: 600; }
.tok-comment { color: #78dce8; font-style: italic; opacity: 0.7; }
</style>
