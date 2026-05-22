export default {
  title: "文档",
  search: "搜索文档...",
  sections: [
    {
      id: "getting-started",
      title: "快速开始",
      items: [
        { id: "overview", title: "概览", content: `<h2>混天DB 概览</h2>
<p>混天DB 是一款高性能<strong>时序安全数据库</strong>，采用 Rust 编写，完全兼容 PostgreSQL Wire Protocol v3.0。专为安全审计追踪、金融事件流和实时可观测性工作负载设计。</p>

<h3>核心能力</h3>
<div class="grid-3">
  <div class="info-card"><strong>PG Wire 兼容</strong><span>使用 psql、DBeaver、JDBC、psycopg2 或任意标准 PostgreSQL 客户端，零代码改动。</span></div>
  <div class="info-card"><strong>极速写入</strong><span>异步无锁 WAL + crossbeam 通道。单节点 Apple Silicon 上 68K+ INSERT/s。</span></div>
  <div class="info-card"><strong>向量化聚合</strong><span>列式缓存 + 连续 f64 切片。10 万行 COUNT(*) 仅需 0.07ms，比 PostgreSQL 快 500 倍。</span></div>
  <div class="info-card"><strong>崩溃安全</strong><span>CRC32 WAL 校验和、LSN 检查点恢复、同步提交模式。Kill -9 零数据丢失。</span></div>
  <div class="info-card"><strong>DBeaver 兼容</strong><span>完整系统目录查询拦截。从 DBeaver GUI 浏览表、执行查询、管理用户。</span></div>
  <div class="info-card"><strong>生产级指标</strong><span>Prometheus 端点，含直方图、仪表、计数器。健康检查端点用于容器编排。</span></div>
</div>

<h3>架构</h3>
<pre><code>前端 (React + TDesign + Monaco)     端口 3000
       |
REST API (axum)  +  PG Wire 协议 (tokio)
       \\                    /
      数据库引擎 (内存 + WAL 持久化)
                |
      data/recovery.log  (zstd 压缩 bincode, 异步写入)
      Prometheus /metrics                 端口 5490</code></pre>` },

        { id: "quickstart", title: "快速启动", content: `<h2>快速启动</h2>

<h3>Docker（推荐）</h3>
<pre><code>docker pull ctkqiang/huntianandb:v0.1.3.beta
docker run -d -p 5408:5408 -p 3000:3000 -p 5490:5490 \\
  -v huntian_data:/app/data \\
  ctkqiang/huntiandb:v0.1.3.beta</code></pre>

<h3>从源码编译</h3>
<pre><code>git clone https://github.com/ctkqiang/HunTianDB
cd HuntianDB/backend
cargo run --release</code></pre>

<h3>连接</h3>
<pre><code>psql -h localhost -p 5408 -U admin -d huntiandb</code></pre>

<p>默认账号：<code>admin</code> / <code>admin123</code></p>

<h3>端口说明</h3>
<table><tr><th>端口</th><th>协议</th><th>说明</th></tr>
<tr><td>5408</td><td>PostgreSQL Wire</td><td>psql、DBeaver、JDBC、psycopg2</td></tr>
<tr><td>3000</td><td>HTTP</td><td>REST API + Web Portal</td></tr>
<tr><td>5490</td><td>HTTP</td><td>Prometheus /metrics + /health + /ready</td></tr></table>` },

        { id: "configuration", title: "配置", content: `<h2>配置</h2>
<p>所有配置通过环境变量设置。</p>

<table><tr><th>变量</th><th>默认值</th><th>说明</th></tr>
<tr><td>POSTGRES_PORT</td><td>5408</td><td>PG 线协议端口</td></tr>
<tr><td>REST_PORT</td><td>3000</td><td>REST API + Portal 端口</td></tr>
<tr><td>METRICS_PORT</td><td>5490</td><td>Prometheus 指标端口（0=禁用）</td></tr>
<tr><td>DATA_DIR</td><td>./data</td><td>数据持久化目录</td></tr>
<tr><td>WAL_ENABLED</td><td>true</td><td>启用 WAL 持久化</td></tr>
<tr><td>SYNC_COMMIT</td><td>on</td><td>off / on / strict</td></tr>
<tr><td>WAL_CHECKSUM</td><td>true</td><td>CRC32 WAL 校验和</td></tr>
<tr><td>CHECKPOINT_INTERVAL_SECS</td><td>300</td><td>检查点间隔（秒）</td></tr>
<tr><td>SLOW_QUERY_THRESHOLD_MS</td><td>100</td><td>慢查询日志阈值（毫秒）</td></tr>
<tr><td>RUST_LOG</td><td>info</td><td>日志级别</td></tr>
</table>` },
      ],
    },
    {
      id: "sql-reference",
      title: "SQL 参考",
      items: [
        { id: "ddl", title: "DDL", content: `<h2>数据定义语言</h2>

<h3>CREATE TABLE</h3>
<pre><code>CREATE TABLE table_name (
  column_name TYPE [NOT NULL],
  ...
);
</code></pre>
<p>支持的类型：<code>BIGINT</code>、<code>INT</code>、<code>SMALLINT</code>、<code>VARCHAR(n)</code>、<code>TEXT</code></p>

<h4>示例</h4>
<pre><code>CREATE TABLE events (
  id BIGINT PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  user_id INT,
  event_type SMALLINT,
  zone SMALLINT,
  status_code SMALLINT,
  ip_address INT,
  payload TEXT
);</code></pre>

<h3>DROP TABLE</h3>
<pre><code>DROP TABLE table_name;</code></pre>

<h3>DESCRIBE / SHOW COLUMNS</h3>
<pre><code>DESCRIBE table_name;
SHOW COLUMNS FROM table_name;</code></pre>
<p>返回：column_name, type, nullable</p>` },

        { id: "dml", title: "DML", content: `<h2>数据操作语言</h2>

<h3>INSERT</h3>
<pre><code>INSERT INTO table_name VALUES (val1, val2, ...);
INSERT INTO table_name VALUES (v1,v2), (v3,v4), ...;</code></pre>
<p>值的数量必须与列数精确匹配。</p>

<h3>SELECT</h3>
<pre><code>SELECT * FROM table_name;
SELECT col1, col2 FROM table_name WHERE condition;
SELECT * FROM table_name ORDER BY col DESC LIMIT 100;</code></pre>
<p>支持：<code>WHERE</code>、<code>LIMIT</code>、<code>ORDER BY</code>、<code>BETWEEN</code></p>` },

        { id: "aggregates", title: "聚合函数", content: `<h2>聚合函数</h2>
<p>所有聚合在引擎内使用列式向量化计算，操作连续的 f64 切片。</p>

<h3>COUNT</h3>
<pre><code>SELECT COUNT(*) FROM events;
SELECT COUNT(column) FROM events;</code></pre>

<h3>SUM / AVG</h3>
<pre><code>SELECT SUM(status_code) FROM events;
SELECT AVG(status_code) FROM events;</code></pre>

<h3>MIN / MAX</h3>
<pre><code>SELECT MIN(timestamp) FROM events;
SELECT MAX(timestamp) FROM events;</code></pre>

<h3>GROUP BY</h3>
<pre><code>SELECT event_type, COUNT(*) FROM events GROUP BY event_type;
SELECT zone, AVG(status_code) FROM events GROUP BY zone ORDER BY COUNT(*) DESC;</code></pre>

<h3>性能数据</h3>
<table><tr><th>操作</th><th>10 万行</th><th>对比 PostgreSQL 16</th></tr>
<tr><td>COUNT(*)</td><td>0.07ms</td><td>快 500 倍</td></tr>
<tr><td>SUM</td><td>5.8ms</td><td>—</td></tr>
<tr><td>AVG</td><td>5.7ms</td><td>—</td></tr>
<tr><td>GROUP BY</td><td>21.9ms</td><td>—</td></tr></table>` },

        { id: "metadata", title: "元数据命令", content: `<h2>元数据命令</h2>

<h3>SHOW TABLES</h3>
<pre><code>SHOW TABLES;</code></pre>
<p>返回：table_name, columns, rows</p>

<h3>SHOW USERS</h3>
<pre><code>SHOW USERS;</code></pre>
<p>返回：username, role</p>

<h3>SHOW / DESCRIBE</h3>
<pre><code>DESCRIBE table_name;
SHOW COLUMNS FROM table_name;</code></pre>` },

        { id: "users", title: "用户管理", content: `<h2>用户管理</h2>

<h3>内置用户</h3>
<table><tr><th>用户名</th><th>密码</th><th>角色</th></tr>
<tr><td>admin</td><td>admin123</td><td>admin</td></tr>
<tr><td>root</td><td>root123</td><td>admin</td></tr>
<tr><td>writer</td><td>writer123</td><td>writer</td></tr>
<tr><td>reader</td><td>reader123</td><td>reader</td></tr></table>

<h3>INSERT INTO users</h3>
<pre><code>INSERT INTO users (username, role) VALUES ('analyst', 'reader');
INSERT INTO users (username, password, role) VALUES ('dba', 'secure789', 'admin');</code></pre>

<h3>CREATE USER</h3>
<pre><code>CREATE USER username 'password' role;</code></pre>

<h3>DROP USER</h3>
<pre><code>DROP USER username;</code></pre>

<h3>角色与权限</h3>
<table><tr><th>角色</th><th>SELECT</th><th>INSERT</th><th>DDL</th><th>用户管理</th></tr>
<tr><td>admin</td><td>允许</td><td>允许</td><td>允许</td><td>允许</td></tr>
<tr><td>writer</td><td>允许</td><td>允许</td><td>允许</td><td>禁止</td></tr>
<tr><td>reader</td><td>允许</td><td>禁止</td><td>禁止</td><td>禁止</td></tr></table>` },
      ],
    },
    {
      id: "internals",
      title: "内部原理",
      items: [
        { id: "wal", title: "WAL 与持久化", content: `<h2>预写日志 (WAL)</h2>

<h3>格式</h3>
<p>WAL 记录使用 <strong>v4 格式</strong>：<code>[0x04][CRC32 LE][LSN LE][uncomp_len LE][comp_len LE][zstd(bincode WalOp)]</code></p>
<p>向后兼容 v1 (JSON)、v2 (未压缩 bincode)、v3 (zstd 无 CRC)。</p>

<h3>压缩</h3>
<table><tr><th>指标</th><th>v1 JSON</th><th>v4 zstd+CRC</th></tr>
<tr><td>每条记录字节数</td><td>~450</td><td>~109</td></tr>
<tr><td>压缩倍率</td><td>无</td><td>5.0x</td></tr>
<tr><td>校验和</td><td>无</td><td>CRC32</td></tr>
</table>

<h3>同步提交</h3>
<table><tr><th>模式</th><th>fsync</th><th>目录同步</th><th>持久性</th></tr>
<tr><td>Off</td><td>否</td><td>否</td><td>由操作系统决定</td></tr>
<tr><td>On</td><td>是</td><td>否</td><td>提交后 fsync</td></tr>
<tr><td>Strict</td><td>是</td><td>是</td><td>fsync WAL + 父目录</td></tr></table>

<h3>异步 WAL 架构</h3>
<pre><code>客户端线程：bincode + zstd + CRC32 → 推入 crossbeam 通道 → 即刻返回
后台 wal-writer：接收 → BufWriter → 每 500 条 fsync</code></pre>

<h3>崩溃恢复</h3>
<ol><li>读取最近检查点 (checkpoint.bin) → last_lsn, wal_offset</li>
<li>从检查点偏移量扫描 WAL</li>
<li>验证每条记录的 CRC32</li>
<li>幂等回放已提交记录</li>
<li>设置 ready 标记 → 接受查询</li></ol>` },

        { id: "aggregation-engine", title: "聚合引擎", content: `<h2>聚合引擎</h2>

<h3>列式缓存</h3>
<p>首次聚合调用时，引擎将数值从 HashMap 行中提取到<strong>连续的 Vec&lt;f64&gt;</strong>切片中。后续聚合直接迭代已缓存的平坦数组——CPU 缓存友好，LLVM 自动向量化。</p>

<pre><code>fn sum_fast(&mut self, col: &str) -> f64 {
    self.ensure_col_f64(col).iter().sum()  // &[f64] → SIMD
}</code></pre>

<h3>缓存失效</h3>
<p>每次 INSERT 时清除列缓存。在下次聚合调用时惰性重建。这确保了数据一致性，代价是每 10 万行约 5-6ms 的重建时间。</p>

<h3>性能数据</h3>
<table><tr><th>行数</th><th>COUNT(*)</th><th>SUM</th><th>AVG</th></tr>
<tr><td>10 万</td><td>0.07ms</td><td>5.8ms</td><td>5.7ms</td></tr>
<tr><td>100 万</td><td>0.15ms</td><td>~60ms</td><td>~60ms</td></tr></table>` },

        { id: "wire-protocol", title: "PG Wire 协议", content: `<h2>PostgreSQL Wire 协议</h2>

<h3>支持的消息类型</h3>
<table><tr><th>类型</th><th>字节</th><th>说明</th></tr>
<tr><td>简单查询</td><td>Q</td><td>标准 SQL 执行</td></tr>
<tr><td>Parse</td><td>P</td><td>预编译语句解析</td></tr>
<tr><td>Bind</td><td>B</td><td>参数绑定</td></tr>
<tr><td>Describe</td><td>D</td><td>列元数据</td></tr>
<tr><td>Execute</td><td>E</td><td>执行预编译语句</td></tr>
<tr><td>Sync</td><td>S</td><td>事务同步</td></tr>
</table>

<h3>系统目录查询拦截</h3>
<p>为支持 DBeaver/pgAdmin，混天DB 拦截 PostgreSQL 系统目录查询并返回兼容的模拟响应：</p>

<table><tr><th>查询</th><th>响应</th></tr>
<tr><td>SELECT version()</td><td>PostgreSQL 16.0 (HunTianDB)</td></tr>
<tr><td>SELECT current_schema()</td><td>public</td></tr>
<tr><td>pg_catalog.pg_database</td><td>数据库列表 (huntiandb)</td></tr>
<tr><td>pg_catalog.pg_class</td><td>表列表含 schema/type/owner</td></tr>
<tr><td>pg_catalog.pg_settings</td><td>服务器设置</td></tr>
<tr><td>pg_catalog.pg_roles</td><td>用户/角色列表</td></tr>
<tr><td>pg_catalog.pg_type</td><td>数据类型定义</td></tr>
</table>` },

        { id: "metrics", title: "指标与可观测性", content: `<h2>指标与可观测性</h2>

<h3>Prometheus 端点</h3>
<pre><code>GET :5490/metrics   → Prometheus 文本格式
GET :5490/health    → 200 若存活
GET :5490/ready     → 200 若 WAL 恢复完成</code></pre>

<h3>导出的指标</h3>
<table><tr><th>指标</th><th>类型</th><th>说明</th></tr>
<tr><td>huntian_wal_fsync_seconds</td><td>直方图</td><td>WAL fsync 耗时 [0.1ms-100ms]</td></tr>
<tr><td>huntian_wal_size_bytes</td><td>仪表</td><td>当前 WAL 文件大小</td></tr>
<tr><td>huntian_wal_replay_lsn</td><td>仪表</td><td>最后回放的 LSN</td></tr>
<tr><td>huntian_memory_usage_bytes</td><td>仪表</td><td>进程 RSS 内存</td></tr>
<tr><td>huntian_open_fds</td><td>仪表</td><td>打开的文件描述符数</td></tr>
<tr><td>huntian_active_queries</td><td>仪表</td><td>当前执行中的查询数</td></tr>
<tr><td>huntian_slow_queries_total</td><td>计数器</td><td>超过阈值的查询数</td></tr>
<tr><td>huntian_checksum_failures_total</td><td>计数器</td><td>WAL/页面校验和失败次数</td></tr>
<tr><td>huntian_query_duration_seconds</td><td>直方图</td><td>查询耗时 [1ms-10s]</td></tr>
<tr><td>huntian_events_written_total</td><td>计数器</td><td>已插入总行数</td></tr>
</table>

<h3>慢查询日志</h3>
<p>超过 <code>SLOW_QUERY_THRESHOLD_MS</code>（默认 100ms）的查询记录到 <code>data/slow.log</code>：</p>
<pre><code>[2026-05-21T10:30:00.123Z] 250ms 192.168.1.5 | SELECT * FROM events WHERE status >= 400</code></pre>` },

        { id: "benchmarks", title: "基准测试", content: `<h2>性能基准测试</h2>
<p>100,000 行 · 单节点 · Apple Silicon macOS · psycopg2 PG Wire 协议</p>

<h3>INSERT 吞吐量</h3>
<table><tr><th>批次大小</th><th>混天DB</th><th>PostgreSQL 16</th><th>QuestDB 7.x</th></tr>
<tr><td>50</td><td>61,316 r/s</td><td>3,200 r/s</td><td>41,000 r/s</td></tr>
<tr><td>200</td><td>67,550 r/s</td><td>6,800 r/s</td><td>110,000 r/s</td></tr>
<tr><td>500</td><td>68,139 r/s</td><td>9,500 r/s</td><td>165,000 r/s</td></tr>
<tr><td>1000</td><td>68,972 r/s</td><td>14,000 r/s</td><td>210,000 r/s</td></tr>
<tr><td>5000</td><td>68,741 r/s</td><td>18,000 r/s</td><td>280,000 r/s</td></tr></table>

<h3>查询延迟 (p50)</h3>
<table><tr><th>查询</th><th>混天DB</th><th>PostgreSQL 16</th><th>QuestDB 7.x</th></tr>
<tr><td>点查询</td><td>0.58ms</td><td>1.2ms</td><td>0.2ms</td></tr>
<tr><td>范围扫描</td><td>0.39ms</td><td>6.0ms</td><td>1.5ms</td></tr>
<tr><td>COUNT(*)</td><td>0.07ms</td><td>35ms</td><td>3.5ms</td></tr>
</table>

<h3>WAL 效率</h3>
<table><tr><th>指标</th><th>v1 JSON</th><th>v4 zstd+CRC</th></tr>
<tr><td>字节/行</td><td>450</td><td>109</td></tr>
<tr><td>压缩倍率</td><td>—</td><td>5.0x</td></tr>
</table>` },
      ],
    },
    {
      id: "examples",
      title: "代码示例",
      items: [
        { id: "python-examples", title: "Python 示例", content: `<h2>Python 使用示例</h2>
<p>所有示例代码位于仓库 <code>examples/</code> 目录。</p>

<table><tr><th>语言</th><th>目录</th><th>驱动</th></tr>
<tr><td>Python</td><td><code>examples/python/</code></td><td>psycopg2</td></tr>
<tr><td>TypeScript</td><td><code>examples/typescript/</code></td><td>pg</td></tr>
<tr><td>Go</td><td><code>examples/go/</code></td><td>lib/pq</td></tr>
<tr><td>Rust</td><td><code>examples/rust/</code></td><td>psql CLI</td></tr>
<tr><td>C</td><td><code>examples/c/</code></td><td>libpq</td></tr>
<tr><td>Erlang</td><td><code>examples/erlang/</code></td><td>epgsql</td></tr>
<tr><td>Haskell</td><td><code>examples/haskell/</code></td><td>postgresql-simple</td></tr>
<tr><td>仓颉</td><td><code>examples/cangjie/</code></td><td>psql CLI</td></tr></table>
<p>每种语言包含 4 个主题脚本：<code>create_table</code>、<code>data_insert_totable</code>、<code>query_data</code>、<code>user_management</code>。</p>

<pre><code># 推荐运行顺序
cd examples/
pip install psycopg2-binary
python3 create_table.py
python3 data_insert_totable.py 10000 500
python3 query_data.py
python3 user_management.py</code></pre>` },
      ],
    },
  ],
};
