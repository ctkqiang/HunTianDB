<template>
  <div class="page">
    <div class="grid-bg" />

    <!-- ═══ NAV ═══ -->
    <nav class="nav" :class="{ scrolled }">
      <div class="nav-inner">
        <a href="#" class="nav-brand">
          <img src="/logo.png" alt="HunTianDB" class="logo-img" />
          <div class="brand-text-group">
            <span class="brand-text">HunTian<span class="accent">DB</span></span>
            <span class="brand-version">v0.1.4</span>
          </div>
        </a>

        <div class="nav-center" :class="{ open: mobileOpen }">
          <a href="#features" @click="mobileOpen=false">{{ t.nav.features }}</a>
          <a href="#performance" @click="mobileOpen=false">{{ t.nav.performance }}</a>
          <a href="#quickstart" @click="mobileOpen=false">{{ t.nav.quickstart }}</a>
          <a href="/docs" @click="mobileOpen=false">{{ t.nav.docs }}</a>
          <span class="nav-sep" />
          <a :href="links.github" target="_blank" class="nav-icon-link"><Github :size="17" /><span>GitHub</span></a>
          <a :href="links.gitcode" target="_blank" class="nav-icon-link"><Gitlab :size="17" /><span>GitCode</span></a>
        </div>

        <div class="nav-actions">
          <div class="lang-dropdown" @click="langOpen = !langOpen">
            <button class="lang-btn"><Globe :size="14" />{{ locale === 'zh' ? '中文' : 'EN' }}<ChevronDown :size="12" /></button>
            <div v-if="langOpen" class="lang-menu">
              <button @click="setLocale('zh'); langOpen=false" :class="{ active: locale === 'zh' }">中文</button>
              <button @click="setLocale('en'); langOpen=false" :class="{ active: locale === 'en' }">English</button>
            </div>
          </div>
          <a href="#quickstart" class="btn-primary btn-desktop">{{ t.nav.getStarted }}</a>
          <button class="hamburger" @click="mobileOpen = !mobileOpen"><span /><span /><span /></button>
        </div>
      </div>
    </nav>

    <!-- ═══ HERO ═══ -->
    <section class="hero">
      <div class="orb o1" /><div class="orb o2" /><div class="orb o3" />
      <div class="hero-inner">
        <div class="hero-badge"><span class="dot" />{{ t.hero.badge }}</div>
        <h1><span class="gradient-text">{{ t.hero.line1 }}</span><br /><span class="gradient-text-teal">{{ t.hero.line2 }}</span></h1>
        <p class="hero-desc">{{ t.hero.desc }}</p>
        <div class="hero-actions">
          <code class="hero-code">docker run -p 5408:5408 -p 3000:3000 huntiandb</code>
          <button class="btn-primary" @click="copyCmd"><Copy :size="16" />{{ copied ? t.hero.copied : t.hero.copy }}</button>
        </div>
        <div class="hero-tags"><span v-for="tag in t.hero.tags" :key="tag"><Check :size="12" />{{ tag }}</span></div>
      </div>
    </section>

    <!-- ═══ FEATURES ═══ -->
    <section id="features" class="section">
      <div class="section-head"><h2>{{ t.features.heading }}</h2><p>{{ t.features.sub }}</p></div>
      <div class="features-grid">
        <div v-for="(f, i) in t.features.items" :key="i" class="fcard reveal" :style="{ transitionDelay: i * 0.08 + 's' }">
          <div class="ficon"><Database v-if="i===0" :size="22" /><Zap v-if="i===1" :size="22" /><Shield v-if="i===2" :size="22" /><BarChart3 v-if="i===3" :size="22" /><Lock v-if="i===4" :size="22" /><Globe v-if="i===5" :size="22" /></div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.desc }}</p>
        </div>
      </div>
    </section>

    <!-- ═══ PERFORMANCE ═══ -->
    <section id="performance" class="section alt">
      <div class="section-head"><h2>{{ t.performance.heading }}</h2><p>{{ t.performance.sub }}</p></div>
      <div class="metrics-grid">
        <div v-for="m in t.performance.metrics" :key="m.label" class="mcard reveal">
          <div class="mval gradient-text">{{ m.value }}</div>
          <div class="mlabel">{{ m.label }}</div>
          <div class="mvs">{{ m.vs }}</div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th v-for="c in t.performance.columns" :key="c" :class="{ hilite: c === 'HunTianDB' || c === '混天DB' }">{{ c }}</th></tr></thead>
          <tbody><tr v-for="(r, i) in t.performance.rows" :key="i"><td>{{ r[0] }}</td><td class="hilite">{{ r[1] }}</td><td>{{ r[2] }}</td><td>{{ r[3] }}</td></tr></tbody>
        </table>
      </div>
    </section>

    <!-- ═══ INSTALLATION STEPS ═══ -->
    <section id="quickstart" class="section">
      <div class="section-head"><h2>{{ t.quickstart.heading }}</h2><p>{{ t.quickstart.sub }}</p></div>

      <div class="steps">
        <div class="step reveal"><div class="step-num">1</div><div class="step-content"><h3>{{ t.quickstart.step1.title }}</h3><p>{{ t.quickstart.step1.desc }}</p><pre><code>docker pull ctkqiang/huntiandb:v0.1.4.beta</code></pre><pre><code>docker pull crpi-onofuhwrkmb5z0mn.cn-hangzhou.personal.cr.aliyuncs.com/nezhawanluoanquan/huntiandb:v0.1.4.beta</code></pre></div></div>

        <div class="step reveal"><div class="step-num">2</div><div class="step-content"><h3>{{ t.quickstart.step2.title }}</h3><p>{{ t.quickstart.step2.desc }}</p><pre><code>docker run -d -p 5408:5408 -p 3000:3000 -p 5490:5490 \
  -v huntian_data:/app/data \
  ctkqiang/huntiandb:v0.1.4.beta</code></pre></div></div>

        <div class="step reveal"><div class="step-num">3</div><div class="step-content"><h3>{{ t.quickstart.step3.title }}</h3><p>{{ t.quickstart.step3.desc }}</p><div class="client-grid"><pre><code v-for="c in t.quickstart.clients" :key="c.label">{{ c.code }}</code></pre></div></div></div>

        <div class="step step-alt reveal"><div class="step-num">*</div><div class="step-content"><h3>{{ t.quickstart.cargo }}</h3><pre><code>git clone https://github.com/ctkqiang/HunTianDB
cd HuntianDB/backend && cargo run --release</code></pre></div></div>
      </div>
    </section>

    <!-- ═══ ARCHITECTURE ═══ -->
    <section class="section alt">
      <div class="section-head"><h2>{{ t.arch.heading }}</h2></div>
      <div class="arch">
        <div v-for="(layer, i) in t.arch.layers" :key="i" class="arch-layer reveal" :class="'arch-' + layer.color" :style="{ transitionDelay: i * 0.1 + 's' }">
          <div class="arch-num">{{ i + 1 }}</div>
          <div><strong>{{ layer.name }}</strong><span>{{ layer.tech }}</span></div>
        </div>
      </div>
    </section>

    <!-- ═══ CHANGELOG ═══ -->
    <section class="section" v-if="t.changelog">
      <div class="section-head"><h2>{{ t.changelog.heading }}</h2></div>
      <div class="changelog">
        <div v-for="(rel, i) in t.changelog.releases" :key="rel.version" class="cl-release reveal" :style="{ transitionDelay: i * 0.1 + 's' }">
          <div class="cl-header">
            <span class="cl-version">{{ rel.version }}</span>
            <span class="cl-date">{{ rel.date }}</span>
          </div>
          <ul class="cl-changes">
            <li v-for="(c, j) in rel.changes" :key="j">{{ c }}</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ═══ FOOTER ═══ -->
    <footer>
      <div class="footer-top">
        <div class="footer-brand">
          <img src="/logo.png" alt="HunTianDB" class="footer-logo" />
          <div><strong>HunTian<span class="accent">DB</span></strong><p>{{ t.footer.tagline }}</p></div>
        </div>
        <div class="footer-col">
          <h4>{{ t.footer.links }}</h4>
          <a :href="links.github" target="_blank"><Github :size="14" /> GitHub</a>
          <a :href="links.gitcode" target="_blank"><Gitlab :size="14" /> GitCode</a>
        </div>
        <div class="footer-col">
          <h4>{{ t.footer.author }}</h4>
          <p>{{ t.footer.authorName }}</p>
          <a href="mailto:johnmelodymel@qq.com">johnmelodymel@qq.com</a>
          <p class="footer-wechat">{{ t.footer.wechat }}: ctkqiang</p>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; 2026 ctkqiang · HunTianDB · {{ t.footer.license }}</span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Copy, Check, Database, Zap, Shield, Lock, BarChart3, Globe, Github, Gitlab, ChevronDown } from "lucide-vue-next";
import { useI18n } from "~/composables/useI18n";

const { t, locale, setLocale } = useI18n();

const copied = ref(false);
const mobileOpen = ref(false);
const langOpen = ref(false);
const scrolled = ref(false);

if (typeof window !== "undefined") {
  window.addEventListener("scroll", () => { scrolled.value = window.scrollY > 20; }, { passive: true });
  window.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".lang-dropdown")) langOpen.value = false;
  });
}

const copyCmd = async () => {
  await navigator.clipboard.writeText("docker run -p 5408:5408 -p 3000:3000 ");
  copied.value = true; setTimeout(() => (copied.value = false), 2000);
};

const links = {
  github: "https://github.com/ctkqiang/HunTianDB",
  gitcode: "https://gitcode.com/ctkqiang_sr/HunTianDB",
};

// copyBlock removed — now handled by CodeBlock component

// ── Scroll reveal animations ──
if (typeof window !== "undefined") {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

  onMounted(() => {
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
  });
  onUnmounted(() => observer.disconnect());
}
</script>

<style>
/* ═══════════════════════════════════════════
   HunTianDB Landing Page — Complete Styles
   ═══════════════════════════════════════════ */
.page { min-height: 100vh; position: relative; overflow-x: hidden; }
.accent { color: #e63946; }

/* ── NAV ── */
.nav { position: fixed; top: 0; width: 100%; z-index: 50; border-bottom: 1px solid transparent; background: transparent; transition: all 0.3s; }
.nav.scrolled { border-bottom-color: rgba(255,255,255,0.06); background: rgba(11,11,22,0.84); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); }
.nav-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.nav-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
.logo-img { width: 32px; height: 32px; border-radius: 7px; }
.brand-text-group { display: flex; flex-direction: column; gap: 0; line-height: 1.1; }
.brand-text { color: #fff; font-weight: 700; font-size: 16px; letter-spacing: -0.3px; }
.brand-version { font-size: 9px; color: #555; font-weight: 500; }
.nav-center { display: flex; align-items: center; gap: 4px; }
.nav-center a { color: #999; text-decoration: none; font-size: 13px; font-weight: 500; padding: 6px 12px; border-radius: 8px; transition: all 0.2s; }
.nav-center a:hover { color: #fff; background: rgba(255,255,255,0.04); }
.nav-sep { width: 1px; height: 16px; background: rgba(255,255,255,0.08); margin: 0 6px; }
.nav-icon-link { display: flex !important; align-items: center; gap: 5px !important; color: #888 !important; font-size: 12px !important; }
.nav-icon-link:hover { color: #fff !important; }
.nav-actions { display: flex; align-items: center; gap: 8px; position: relative; }

/* lang dropdown */
.lang-dropdown { position: relative; }
.lang-btn { background: rgba(255,255,255,0.05); color: #bbb; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 7px 11px; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.2s; font-family: inherit; }
.lang-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
.lang-menu { position: absolute; top: 42px; right: 0; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; min-width: 110px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); z-index: 100; }
.lang-menu button { display: block; width: 100%; padding: 10px 16px; border: none; background: none; color: #bbb; font-size: 13px; cursor: pointer; text-align: left; font-family: inherit; transition: all 0.15s; }
.lang-menu button:hover { background: rgba(230,57,70,0.1); color: #fff; }
.lang-menu button.active { color: #e63946; font-weight: 600; }

.btn-primary { background: #e63946; color: #fff; border: none; border-radius: 10px; padding: 10px 20px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 7px; transition: all 0.2s; font-family: inherit; }
.btn-primary:hover { background: #ff4d5a; box-shadow: 0 0 28px rgba(230,57,70,0.3); }

.hamburger { display: none; flex-direction: column; gap: 4px; background: none; border: none; cursor: pointer; padding: 6px; }
.hamburger span { display: block; width: 20px; height: 2px; background: #fff; border-radius: 2px; transition: all 0.3s; }

@media (max-width: 860px) {
  .btn-desktop { display: none; }
  .hamburger { display: flex; }
  .nav-center { display: none; position: absolute; top: 64px; left: 0; right: 0; flex-direction: column; align-items: stretch; gap: 2px; background: rgba(11,11,22,0.96); backdrop-filter: blur(24px); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 8px 20px 16px; }
  .nav-center.open { display: flex; }
  .nav-center a { padding: 10px 12px; font-size: 14px; }
  .nav-sep { display: none; }
}

/* ── HERO ── */
.hero { position: relative; padding: 140px 24px 96px; overflow: hidden; }
.hero-inner { max-width: 880px; margin: 0 auto; text-align: center; position: relative; z-index: 1; }
.hero-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 20px; background: rgba(24,24,42,0.7); border: 1px solid rgba(255,255,255,0.08); font-size: 13px; color: #bbb; margin-bottom: 28px; animation: fadeIn 0.6s ease; }
.dot { width: 6px; height: 6px; border-radius: 3px; background: #4ade80; animation: pulseDot 2s infinite; }
.hero h1 { font-size: clamp(36px, 8vw, 82px); font-weight: 900; line-height: 1.08; margin-bottom: 22px; color: #fff; }
.hero-desc { font-size: 17px; color: #8a8a9a; max-width: 580px; margin: 0 auto 36px; line-height: 1.7; animation: slideUp 0.6s 0.15s both; }
.hero-actions { display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap; animation: slideUp 0.6s 0.3s both; }
.hero-code { background: #16162b; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 20px; font-family: "JetBrains Mono", monospace; font-size: 13px; color: #ccc; overflow-x: auto; white-space: nowrap; }
.hero-tags { display: flex; flex-wrap: wrap; justify-content: center; gap: 22px; margin-top: 40px; font-size: 13px; color: #8a8a9a; animation: fadeIn 0.6s 0.5s both; }
.hero-tags span { display: flex; align-items: center; gap: 6px; }

.orb { position: absolute; border-radius: 50%; filter: blur(70px); opacity: 0.2; }
.o1 { width: 280px; height: 280px; background: #e63946; top: 80px; left: 5%; animation: float 6s infinite; }
.o2 { width: 380px; height: 380px; background: #2ec4b6; top: 180px; right: -5%; animation: float 8s 2s infinite; }
.o3 { width: 260px; height: 260px; background: #f4a261; bottom: 80px; left: 30%; animation: float 7s 4s infinite; }

/* ── SECTIONS ── */
.section { padding: 96px 24px; }
.section.alt { background: rgba(18,18,32,0.35); }
.section-head { text-align: center; margin-bottom: 56px; }
.section-head h2 { font-size: clamp(28px, 5vw, 42px); font-weight: 800; color: #fff; margin-bottom: 10px; }
.section-head p { font-size: 15px; color: #8a8a9a; max-width: 520px; margin: 0 auto; }

/* ── FEATURES ── */
.features-grid { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
.fcard { background: #18182a; border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; padding: 28px; transition: all 0.3s; animation: scaleIn 0.5s both; }
.fcard:hover { border-color: #e63946; transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
.ficon { width: 42px; height: 42px; border-radius: 10px; background: rgba(230,57,70,0.1); color: #e63946; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
.fcard h3 { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 7px; }
.fcard p { font-size: 13px; color: #8a8a9a; line-height: 1.65; }

/* ── METRICS ── */
.metrics-grid { max-width: 880px; margin: 0 auto 44px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
.mcard { background: #18182a; border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; padding: 24px; text-align: center; }
.mval { font-size: 24px; font-weight: 800; }
.mlabel { font-size: 12px; color: #8a8a9a; margin-top: 4px; }
.mvs { font-size: 11px; color: #2ec4b6; margin-top: 6px; }

.table-wrap { max-width: 740px; margin: 0 auto; background: rgba(24,24,42,0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; padding: 28px; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; padding: 10px 14px; font-weight: 600; color: #8a8a9a; border-bottom: 1px solid rgba(255,255,255,0.06); }
td { padding: 10px 14px; color: #ccc; border-bottom: 1px solid rgba(255,255,255,0.04); }
.hilite { color: #e63946 !important; font-weight: 700; }

/* ── STEPS ── */
.steps { max-width: 780px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; }
.step { display: flex; gap: 18px; }
.step-num { width: 40px; height: 40px; border-radius: 50%; background: #e63946; color: #fff; font-weight: 800; font-size: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.step-alt .step-num { background: #2a2a4a; font-size: 22px; }
.step-content { flex: 1; min-width: 0; }
.step-content h3 { font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 4px; }
.step-content p { font-size: 13px; color: #8a8a9a; margin-bottom: 12px; }
.code-block { background: #12121f; border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; margin-bottom: 8px; position: relative; }
.code-block .copy-btn { position: absolute; top: 6px; right: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; color: #8a8a9a; cursor: pointer; padding: 4px 7px; font-size: 10px; display: flex; align-items: center; gap: 3px; transition: all 0.2s; z-index: 2; font-family: var(--font); line-height: 1; }
.code-block .copy-btn:hover { background: rgba(255,255,255,0.14); color: #fff; border-color: rgba(255,255,255,0.15); }
.code-label { padding: 8px 16px; font-size: 10px; font-weight: 600; color: #8a8a9a; background: #1a1a2e; border-bottom: 1px solid rgba(255,255,255,0.04); font-family: "JetBrains Mono", monospace; text-transform: uppercase; letter-spacing: 0.5px; }
.code-block pre { padding: 16px 20px; margin: 0; overflow-x: auto; }
.code-block code { font-family: "JetBrains Mono", monospace; font-size: 12.5px; color: #ccc; line-height: 1.7; white-space: pre; }
.code-block { background: #12121f; border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; margin-bottom: 8px; position: relative; }
.code-block .copy-btn { position: absolute; top: 6px; right: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; color: #8a8a9a; cursor: pointer; padding: 4px 7px; font-size: 10px; display: flex; align-items: center; gap: 3px; transition: all 0.2s; z-index: 2; font-family: "Inter", sans-serif; line-height: 1; }
.code-block .copy-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }
.code-block pre { padding: 16px 20px; margin: 0; overflow-x: auto; }
.code-block code { font-family: "JetBrains Mono", monospace; font-size: 13px; color: #ccc; line-height: 1.7; white-space: pre; display: block; }
pre { background: #12121f; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px 20px; overflow-x: auto; margin: 8px 0; }
pre code { font-family: "JetBrains Mono", monospace; font-size: 13px; color: #ccc; line-height: 1.7; white-space: pre; display: block; }
.client-grid pre { max-height: 140px; overflow-y: auto; margin: 0; }

.client-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 10px; }
.client-grid .cb-wrap { margin: 0; }
.client-grid .cb-wrap pre { max-height: 140px; overflow-y: auto; }
@media (max-width: 600px) { .client-grid { grid-template-columns: 1fr; } }

/* ── ARCHITECTURE ── */
.arch { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 2px; }
.arch-layer { display: flex; align-items: center; gap: 14px; padding: 16px 20px; border-radius: 12px; background: rgba(24,24,42,0.6); border: 1px solid rgba(255,255,255,0.04); }
.arch-num { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: #fff; flex-shrink: 0; }
.arch-accent { border-left: 3px solid #e63946; } .arch-accent .arch-num { background: #e63946; }
.arch-gold { border-left: 3px solid #f4a261; } .arch-gold .arch-num { background: #f4a261; }
.arch-teal { border-left: 3px solid #2ec4b6; } .arch-teal .arch-num { background: #2ec4b6; }
.arch-dim { border-left: 3px solid #555; } .arch-dim .arch-num { background: #555; }
.arch-layer strong { display: block; font-size: 14px; color: #fff; margin-bottom: 1px; }
.arch-layer span { display: block; font-size: 12px; color: #8a8a9a; }

/* ── FOOTER ── */
footer { padding: 60px 24px 28px; border-top: 1px solid rgba(255,255,255,0.05); }
.footer-top { max-width: 960px; margin: 0 auto 36px; display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 40px; }
.footer-brand { display: flex; align-items: flex-start; gap: 12px; }
.footer-logo { width: 28px; height: 28px; border-radius: 6px; margin-top: 2px; }
.footer-brand strong { font-size: 15px; color: #fff; display: block; margin-bottom: 3px; }
.footer-brand p { font-size: 12px; color: #8a8a9a; line-height: 1.5; }
.footer-col h4 { color: #fff; font-size: 12px; font-weight: 700; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.8px; }
.footer-col a, .footer-col p { color: #8a8a9a; font-size: 13px; text-decoration: none; display: flex; align-items: center; gap: 6px; margin-bottom: 5px; transition: color 0.2s; }
.footer-col a:hover { color: #e63946; }
.footer-wechat { font-family: "JetBrains Mono", monospace; }
.footer-bottom { max-width: 960px; margin: 0 auto; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.04); text-align: center; font-size: 12px; color: #555; }

@media (max-width: 768px) {
  .hero { padding: 100px 16px 60px; }
  .hero-actions { flex-direction: column; }
  .hero-code { font-size: 11px; padding: 12px 16px; }
  .section { padding: 60px 16px; }
  .features-grid { grid-template-columns: 1fr; }
  .footer-top { grid-template-columns: 1fr; gap: 24px; }
  .metrics-grid { grid-template-columns: repeat(2, 1fr); }
  .step { flex-direction: column; gap: 10px; }
  .step-num { width: 32px; height: 32px; font-size: 15px; }
}

/* ── ANIMATIONS ── */
@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
@keyframes slideUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes pulseDot { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

/* ── SCROLL REVEAL ── */
.reveal { opacity: 0; transform: translateY(24px); transition: all 0.6s cubic-bezier(0.22, 0.61, 0.36, 1); }
.reveal.visible { opacity: 1; transform: translateY(0); }

/* ── CHANGELOG ── */
.changelog { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
.cl-release { background: #18182a; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 22px 26px; transition: all 0.3s; }
.cl-release:hover { border-color: rgba(255,255,255,0.1); }
.cl-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.cl-version { background: #e63946; color: #fff; padding: 3px 10px; border-radius: 6px; font-size: 13px; font-weight: 700; font-family: "JetBrains Mono", monospace; }
.cl-date { font-size: 12px; color: #8a8a9a; }
.cl-changes { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.cl-changes li { font-size: 13px; color: #bbb; padding-left: 16px; position: relative; line-height: 1.5; }
.cl-changes li::before { content: ""; position: absolute; left: 0; top: 9px; width: 6px; height: 6px; border-radius: 50%; background: rgba(230,57,70,0.4); }

/* ── SYNTAX HIGHLIGHTING (Vibrant) ── */
.tok-kw { color: #ff6188; font-weight: 700; }
.tok-cmd { color: #78dce8; font-weight: 700; }
.tok-str { color: #ffd866; }
.tok-flag { color: #ab9df2; }
.tok-num { color: #ab9df2; }
.tok-fn { color: #a9dc76; font-weight: 600; }
.tok-var { color: #f8f8f2; }
.tok-type { color: #fc9867; font-weight: 600; }
.tok-comment { color: #78dce8; font-style: italic; opacity: 0.7; }

.code-block pre code { color: #f8f8f2; }
.code-block pre code .tok-kw,
.code-block pre code .tok-cmd,
.code-block pre code .tok-str,
.code-block pre code .tok-flag,
.code-block pre code .tok-num,
.code-block pre code .tok-fn,
.code-block pre code .tok-var { font-family: inherit; }
</style>
