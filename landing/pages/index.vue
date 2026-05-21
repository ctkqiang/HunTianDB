<template>
  <div class="page">
    <!-- Grid background -->
    <div class="grid-bg" />

    <!-- NAV -->
    <nav class="nav">
      <div class="nav-inner">
        <div class="nav-brand">
          <span class="brand-icon">混</span>
          <span class="brand-text">HunTian<span class="brand-accent">DB</span></span>
        </div>
        <div class="nav-links">
          <a href="#features">Features</a>
          <a href="#performance">Performance</a>
          <a href="#quickstart">Quick Start</a>
          <a href="https://github.com/ctkqiang/HunTianDB" target="_blank">GitHub</a>
        </div>
        <a href="#quickstart" class="btn-primary">Get Started</a>
      </div>
    </nav>

    <!-- HERO -->
    <section class="hero">
      <div class="orb orb-1" />
      <div class="orb orb-2" />
      <div class="orb orb-3" />

      <div class="hero-content">
        <div class="hero-badge">
          <span class="dot" />
          Production Ready · v0.1.3
        </div>

        <h1>
          <span>The </span><span class="gradient-text">Timeseries</span><br />
          <span>Security </span><span class="gradient-text-teal">Database</span>
        </h1>

        <p class="hero-desc">
          PostgreSQL wire protocol compatible. Built in Rust for blistering speed.
          Designed for security audit trails, financial event streams, and real-time observability.
        </p>

        <div class="hero-actions">
          <code class="hero-code">docker run -p 5408:5408 -p 3000:3000 huntiandb</code>
          <button class="btn-primary" @click="copyCmd">
            <CopyIcon :size="16" />
            {{ copied ? 'Copied!' : 'Copy' }}
          </button>
        </div>

        <div class="hero-tags">
          <span><CheckIcon :size="12" /> PG Wire Protocol v3</span>
          <span><CheckIcon :size="12" /> DBeaver Compatible</span>
          <span><CheckIcon :size="12" /> 68K INSERT/s</span>
          <span><CheckIcon :size="12" /> Zstd WAL</span>
        </div>
      </div>
    </section>

    <!-- FEATURES -->
    <section id="features" class="section">
      <div class="section-header">
        <h2>Engineered for <span class="gradient-text">Performance</span></h2>
        <p>Every line of Rust is optimized for speed, safety, and reliability.</p>
      </div>
      <div class="features-grid">
        <div v-for="(f, i) in features" :key="i" class="feature-card" :style="{ animationDelay: i * 0.1 + 's' }">
          <div class="feature-icon"><component :is="f.icon" :size="24" /></div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.desc }}</p>
        </div>
      </div>
    </section>

    <!-- PERFORMANCE -->
    <section id="performance" class="section section-alt">
      <div class="section-header">
        <h2>Benchmark <span class="gradient-text-teal">Results</span></h2>
        <p>100,000 rows · Single Node · Apple Silicon macOS · psycopg2 PG Wire</p>
      </div>

      <div class="metrics-grid">
        <div v-for="m in metrics" :key="m.label" class="metric-card">
          <div class="metric-value text-gradient">{{ m.value }}</div>
          <div class="metric-label">{{ m.label }}</div>
          <div class="metric-vs">{{ m.vs }}</div>
        </div>
      </div>

      <div class="glass table-wrap">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th class="th-accent">HunTianDB</th>
              <th>PostgreSQL 16</th>
              <th>QuestDB 7.x</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in tableData" :key="r.name">
              <td>{{ r.name }}</td>
              <td class="td-accent">{{ r.huntian }}</td>
              <td>{{ r.postgres }}</td>
              <td>{{ r.quest }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- QUICK START -->
    <section id="quickstart" class="section">
      <div class="section-header">
        <h2>Run in <span class="gradient-text">Seconds</span></h2>
        <p>Single binary. No dependencies. PostgreSQL compatible.</p>
      </div>
      <div class="code-blocks">
        <div v-for="b in codeBlocks" :key="b.title" class="code-block">
          <div class="code-label">{{ b.title }}</div>
          <pre><code :class="'lang-' + b.lang">{{ b.code }}</code></pre>
        </div>
      </div>
    </section>

    <!-- ARCHITECTURE -->
    <section class="section section-alt">
      <div class="section-header">
        <h2>System <span class="gradient-text-teal">Architecture</span></h2>
      </div>
      <div class="glass arch-diagram">
        <pre>
<span class="c-teal">┌─────────────────────────────────────┐</span>
<span class="c-teal">│</span>  <span class="c-accent">React + TDesign + Monaco</span>          <span class="c-teal">│</span>  ← Frontend (Port 3000)
<span class="c-teal">├─────────────────────────────────────┤</span>
<span class="c-teal">│</span>  <span class="c-gold">Axum REST API  +  PG Wire (tokio)</span>  <span class="c-teal">│</span>  ← Protocol Layer
<span class="c-teal">├──────────────┬──────────────────────┤</span>
<span class="c-teal">│</span>  Database Engine                    <span class="c-teal">│</span>
<span class="c-teal">│</span>  ├─ Columnar Cache (Vec&lt;f64&gt;)       <span class="c-teal">│</span>  ← Vectorized Agg
<span class="c-teal">│</span>  ├─ Async WAL (crossbeam channel)   <span class="c-teal">│</span>  ← Lock-free Write
<span class="c-teal">│</span>  ├─ Zstd Compressed Bincode          <span class="c-teal">│</span>  ← 5x Smaller V1
<span class="c-teal">│</span>  ├─ CRC32 Checksums                 <span class="c-teal">│</span>  ← Corruption Detection
<span class="c-teal">│</span>  ├─ LSN + Checkpoint                <span class="c-teal">│</span>  ← Crash Recovery
<span class="c-teal">│</span>  └─ Prometheus /metrics             <span class="c-teal">│</span>  ← Port 5490
<span class="c-teal">├─────────────────────────────────────┤</span>
<span class="c-teal">│</span>  data/recovery.log                   <span class="c-teal">│</span>  ← WAL Persistence
<span class="c-teal">└─────────────────────────────────────┘</span>
        </pre>
      </div>
    </section>

    <!-- FOOTER -->
    <footer>
      <div class="footer-inner">
        <div class="footer-brand">
          <span class="brand-icon-sm">混</span>
          <span>HunTianDB &copy; 2026</span>
        </div>
        <div class="footer-links">
          <a href="https://github.com/ctkqiang/HunTianDB" target="_blank">GitHub</a>
          <span class="footer-divider">·</span>
          <span class="c-accent">MIT License</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Copy, Check, Database, Zap, Shield, Lock, BarChart3, Globe } from "lucide-vue-next";

const copied = ref(false);
const copyCmd = async () => {
  await navigator.clipboard.writeText("docker run -p 5408:5408 -p 3000:3000 huntiandb");
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
};

const features = [
  { icon: Database, title: "PG Wire Protocol v3", desc: "Native PostgreSQL wire protocol. Use psql, DBeaver, JDBC, or any standard PG client. Zero migration cost." },
  { icon: Zap, title: "Async Lock‑Free WAL", desc: "Write path uses crossbeam channels. Client returns instantly. Background thread handles zstd compression and disk sync." },
  { icon: Shield, title: "Crash Safe", desc: "CRC32 WAL checksums, LSN checkpoint recovery, synchronous commit modes. Kill -9 and restart — zero data loss." },
  { icon: BarChart3, title: "Vectorized Aggregation", desc: "Columnar cache with flat f64 slices. COUNT(*) in 0.07ms on 100K rows — 500x faster than PostgreSQL." },
  { icon: Lock, title: "SCRAM‑SHA‑256 Auth", desc: "Production-grade password verification with salted hashes. Built-in admin, writer, reader roles." },
  { icon: Globe, title: "Docker Single Binary", desc: "One image, three ports. PG wire, REST+Portal, Prometheus metrics. docker pull and run in seconds." },
];

const metrics = [
  { label: "INSERT Throughput", value: "68,741 r/s", vs: "1.8x vs PG16" },
  { label: "Point Lookup", value: "0.58ms", vs: "2.1x vs PG16" },
  { label: "COUNT(*) 100K", value: "0.07ms", vs: "500x vs PG16" },
  { label: "WAL Size", value: "109 bytes", vs: "5x smaller v1" },
];

const tableData = [
  { name: "INSERT (batch=5000)", huntian: "68,741 r/s", postgres: "38,000 r/s", quest: "280,000 r/s" },
  { name: "Point Lookup p50", huntian: "0.58ms", postgres: "1.2ms", quest: "0.2ms" },
  { name: "COUNT(*) 100K rows", huntian: "0.07ms", postgres: "35ms", quest: "3.5ms" },
  { name: "DDL CREATE TABLE", huntian: "4.0ms", postgres: "12ms", quest: "8.0ms" },
  { name: "WAL per row", huntian: "109 bytes", postgres: "—", quest: "—" },
];

const codeBlocks = [
  { title: "Docker", lang: "bash", code: `# International (Docker Hub)
docker pull ctkqiang/huntiandb:v0.1.3.beta

# China (Alibaba Cloud)
docker pull crpi-onofuhwrkmb5z0mn.cn-hangzhou.personal.cr.aliyuncs.com/nezhawanluoanquan/huntiandb:v0.1.3.beta

# Run
docker run -d -p 5408:5408 -p 3000:3000 -p 5490:5490 \\
  -v huntian_data:/app/data \\
  ctkqiang/huntiandb:v0.1.3.beta` },
  { title: "Cargo", lang: "bash", code: `git clone https://github.com/ctkqiang/HunTianDB
cd HuntianDB/backend
cargo run --release` },
  { title: "Connect with psql", lang: "sql", code: `psql -h localhost -p 5408 -U admin -d huntiandb

SELECT event_type, COUNT(*) FROM events GROUP BY event_type;
SHOW TABLES;
SELECT * FROM events WHERE status_code >= 400 LIMIT 10;` },
  { title: "Connect with Python", lang: "python", code: `import psycopg2
conn = psycopg2.connect(
    host="localhost", port=5408,
    user="admin", password="admin123",
    dbname="huntiandb"
)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM events")
print(cur.fetchone())  # ('1000',)` },
];
</script>

<style scoped>
/* ── Layout ── */
.page { min-height: 100vh; position: relative; overflow-x: hidden; }

/* ── Grid BG ── */
.grid-bg {
  position: fixed; inset: 0; pointer-events: none; opacity: 0.03;
  background-image: radial-gradient(circle, rgba(230,57,70,0.8) 1px, transparent 1px);
  background-size: 40px 40px;
  animation: gridMove 20s linear infinite;
}

/* ── NAV ── */
.nav {
  position: fixed; top: 0; width: 100%; z-index: 50;
  border-bottom: 1px solid var(--white-5);
  background: rgba(15,15,26,0.8); backdrop-filter: blur(20px);
}
.nav-inner {
  max-width: 1280px; margin: 0 auto; padding: 0 24px;
  height: 64px; display: flex; align-items: center; justify-content: space-between;
}
.nav-brand { display: flex; align-items: center; gap: 10px; }
.brand-icon {
  width: 32px; height: 32px; border-radius: 8px;
  background: linear-gradient(135deg, var(--accent), var(--gold));
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 14px;
}
.brand-text { color: #fff; font-weight: 700; font-size: 18px; letter-spacing: -0.5px; }
.brand-accent { color: var(--accent); }
.nav-links { display: flex; gap: 32px; }
.nav-links a { color: #999; text-decoration: none; font-size: 14px; transition: color 0.2s; }
.nav-links a:hover { color: #fff; }

.btn-primary {
  background: var(--accent); color: #fff; border: none; border-radius: 10px;
  padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer;
  text-decoration: none; display: inline-flex; align-items: center; gap: 8px;
  transition: all 0.2s;
}
.btn-primary:hover { background: var(--accent-light); box-shadow: 0 0 30px rgba(230,57,70,0.25); }

/* ── HERO ── */
.hero {
  position: relative; padding: 140px 24px 100px; overflow: hidden;
}
.hero-content { max-width: 960px; margin: 0 auto; text-align: center; position: relative; z-index: 1; }
.hero-badge {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 16px; border-radius: 20px;
  background: rgba(30,30,58,0.6); border: 1px solid var(--white-10);
  font-size: 13px; color: #bbb; margin-bottom: 32px;
  animation: fadeIn 0.6s ease;
}
.dot { width: 6px; height: 6px; border-radius: 3px; background: #4ade80; animation: pulse-dot 2s infinite; }
.hero h1 {
  font-size: clamp(40px, 8vw, 90px); font-weight: 900; line-height: 1.05; margin-bottom: 24px;
}
.hero-desc {
  font-size: 18px; color: var(--text-dim); max-width: 640px; margin: 0 auto 40px;
  line-height: 1.7; animation: slideUp 0.6s 0.15s both;
}
.hero-actions {
  display: flex; align-items: center; justify-content: center; gap: 12px;
  flex-wrap: wrap; animation: slideUp 0.6s 0.3s both;
}
.hero-code {
  background: var(--db-800); border: 1px solid var(--white-10); border-radius: 12px;
  padding: 14px 20px; font-family: var(--mono); font-size: 13px; color: #ccc;
  max-width: 100%; overflow-x: auto; white-space: nowrap;
}
.hero-tags {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 24px;
  margin-top: 48px; font-size: 13px; color: var(--text-dim);
  animation: fadeIn 0.6s 0.5s both;
}
.hero-tags span { display: flex; align-items: center; gap: 6px; }

/* ── Orbs ── */
.orb {
  position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.25;
}
.orb-1 { width: 300px; height: 300px; background: var(--accent); top: 80px; left: 5%; animation: float 6s infinite; }
.orb-2 { width: 400px; height: 400px; background: var(--teal); top: 200px; right: 0; animation: float 8s 2s infinite; }
.orb-3 { width: 250px; height: 250px; background: var(--gold); bottom: 100px; left: 30%; animation: float 7s 4s infinite; }

/* ── SECTIONS ── */
.section { padding: 100px 24px; }
.section-alt { background: rgba(18,18,32,0.5); }
.section-header { text-align: center; margin-bottom: 64px; }
.section-header h2 { font-size: clamp(30px, 5vw, 48px); font-weight: 800; margin-bottom: 12px; }
.section-header p { font-size: 17px; color: var(--text-dim); max-width: 560px; margin: 0 auto; }

/* ── FEATURES GRID ── */
.features-grid {
  max-width: 1100px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;
}
.feature-card {
  background: var(--db-800); border: 1px solid var(--white-5); border-radius: var(--radius);
  padding: 32px; transition: all 0.3s; animation: scaleIn 0.5s both;
}
.feature-card:hover { border-color: var(--accent); transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
.feature-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(230,57,70,0.1); color: var(--accent); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.feature-card h3 { font-size: 17px; font-weight: 700; color: #fff; margin-bottom: 8px; }
.feature-card p { font-size: 14px; color: var(--text-dim); line-height: 1.7; }

/* ── METRICS ── */
.metrics-grid {
  max-width: 900px; margin: 0 auto 48px;
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;
}
.metric-card {
  background: var(--db-800); border: 1px solid var(--white-5); border-radius: var(--radius);
  padding: 28px; text-align: center;
}
.metric-value { font-size: 28px; font-weight: 800; }
.metric-label { font-size: 13px; color: var(--text-dim); margin-top: 6px; }
.metric-vs { font-size: 12px; color: var(--teal); margin-top: 8px; }

/* ── TABLE ── */
.table-wrap { max-width: 800px; margin: 0 auto; padding: 32px; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; padding: 12px 16px; font-weight: 600; color: var(--text-dim); border-bottom: 1px solid var(--white-8); }
td { padding: 12px 16px; color: #ccc; border-bottom: 1px solid var(--white-5); }
.th-accent, .td-accent { color: var(--accent) !important; font-weight: 700; }

/* ── CODE BLOCKS ── */
.code-blocks { max-width: 750px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
.code-block {
  background: var(--db-800); border: 1px solid var(--white-5); border-radius: var(--radius);
  overflow: hidden;
}
.code-label {
  padding: 10px 20px; font-size: 12px; font-weight: 600; color: var(--text-dim);
  background: var(--db-700); border-bottom: 1px solid var(--white-5);
  font-family: var(--mono); text-transform: uppercase; letter-spacing: 1px;
}
.code-block pre { padding: 20px; margin: 0; overflow-x: auto; }
.code-block code {
  font-family: var(--mono); font-size: 13px; color: #ccc; line-height: 1.7;
  white-space: pre;
}

/* ── ARCH ── */
.arch-diagram {
  max-width: 650px; margin: 0 auto; padding: 40px;
  font-family: var(--mono); font-size: 14px; line-height: 1.8;
  overflow-x: auto;
}
.c-teal { color: var(--teal); }
.c-accent { color: var(--accent); }
.c-gold { color: var(--gold); }

/* ── FOOTER ── */
footer { padding: 64px 24px; border-top: 1px solid var(--white-5); }
.footer-inner {
  max-width: 1100px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px; font-size: 13px; color: var(--text-dim);
}
.footer-brand { display: flex; align-items: center; gap: 10px; }
.brand-icon-sm {
  width: 24px; height: 24px; border-radius: 6px;
  background: linear-gradient(135deg, var(--accent), var(--gold));
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 11px;
}
.footer-links { display: flex; align-items: center; gap: 16px; }
.footer-links a { color: var(--text-dim); text-decoration: none; transition: color 0.2s; }
.footer-links a:hover { color: #fff; }

/* ── RESPONSIVE ── */
@media (max-width: 768px) {
  .nav-links { display: none; }
  .hero { padding: 100px 16px 60px; }
  .hero-actions { flex-direction: column; }
  .hero-code { font-size: 11px; }
  .section { padding: 60px 16px; }
  .footer-inner { flex-direction: column; text-align: center; }
  .features-grid { grid-template-columns: 1fr; }
}
</style>
