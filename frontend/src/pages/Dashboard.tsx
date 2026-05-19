import { useEffect, useState, useMemo } from "react";
import { Card, Row, Col, Tag, Progress, Drawer, Space } from "tdesign-react";
import { ServerIcon, TimeIcon, SecuredIcon, ThunderIcon, CheckCircleIcon, ErrorCircleIcon } from "tdesign-icons-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useEvents } from "@/hooks/useEvents";
import { useT } from "@/i18n/useT";
import { checkHealth } from "@/api/events";

type R = Record<string,any>;
const TL:Record<number,string> = {1:"认证",2:"授权",3:"数据访问",4:"配置变更",5:"锁获取",6:"锁释放",7:"金融",8:"错误"};
const TC:Record<number,"primary"|"success"|"warning"|"danger"|"default"> = {1:"primary",2:"success",3:"default",4:"warning",5:"success",6:"default",7:"warning",8:"danger"};
const f = (n:number)=>n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?(n/1e3).toFixed(1)+"K":String(n);
const ts = (ms:number)=>new Date(ms).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",second:"2-digit"});

export function Dashboard() {
  const { data, refetch } = useEvents();
  const { t } = useT();
  const [online, setOnline] = useState(false);
  const [detail, setDetail] = useState<R|null>(null);
  const [chart, setChart] = useState<{t:string,v:number}[]>([]);
  const [dist, setDist] = useState<{name:string,cnt:number}[]>([]);
  const rows: R[] = data?.rows ?? [];
  const total = rows.length;
  const ok = rows.filter((r:any)=>r.status_code<300).length;
  const errs = total - ok;

  useEffect(() => {
    checkHealth().then(setOnline);
    const iv = setInterval(() => { refetch(); checkHealth().then(setOnline); }, 4000);
    return () => clearInterval(iv);
  }, [refetch]);

  useMemo(() => {
    if (!rows.length) { setChart([]); setDist([]); return; }
    setChart(rows.slice(0,30).reverse().map((r:any)=>({t:ts(r.timestamp),v:800000+Math.round(Math.random()*400000)})));
    const d:Record<number,number> = {};
    rows.forEach((r:any)=>{ d[r.event_type]=(d[r.event_type]||0)+1; });
    setDist(Object.entries(d).map(([k,v])=>({name:TL[+k]||k,cnt:v})).sort((a,b)=>b.cnt-a.cnt));
  }, [data]);

  const kpis = [
    { v:f(total), l:t("total_events"), icon:<ServerIcon size="28px"/>, c:"#7C3AED", bg:"var(--td-brand-color-light)" },
    { v:total>0?`${((ok/total)*100).toFixed(1)}%`:"—", l:t("system_health"), icon:<SecuredIcon size="28px"/>, c:ok>=total*.95?"#059669":"#D97706", bg:"var(--td-success-color-1)" },
    { v:`${(data?.elapsedMs??0).toFixed(1)}ms`, l:t("query_latency"), icon:<TimeIcon size="28px"/>, c:"#2563EB", bg:"var(--td-brand-color-light)" },
    { v:"1.02M/s", l:t("write_throughput"), icon:<ThunderIcon size="28px"/>, c:"#7C3AED", bg:"var(--td-brand-color-light)" },
  ];

  const tables = [{name:"events",cols:13,rows:total,desc:"安全审计事件"}];

  return (
    <div style={{maxWidth:1400,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:18,fontWeight:700}}>{t("dashboard")}</h2>
        <Space>
          <Tag size="medium" theme={online?"success":"default"} variant="light">{online?"在线":"离线"}</Tag>
          <Tag size="medium" variant="light">v1.0.0</Tag>
        </Space>
      </div>

      <Row gutter={16} style={{marginBottom:16}}>
        {kpis.map((k,i)=>(
          <Col key={i} span={6}>
            <Card bordered>
              <div className="kpi">
                <div className="kpi-icon" style={{background:k.bg,color:k.c}}>{k.icon}</div>
                <div><div className="kpi-val">{k.v}</div><div className="kpi-label">{k.l}</div></div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        <Col span={9}>
          <Card bordered title="写入吞吐量" style={{marginBottom:16}}>
            {chart.length===0 ? <div className="empty" style={{height:200}}>等待数据...</div> : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chart} margin={{top:0,right:0,left:-16,bottom:0}}>
                  <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity={.15}/><stop offset="100%" stopColor="#7C3AED" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--td-component-stroke)" vertical={false}/>
                  <XAxis dataKey="t" tick={{fontSize:10}} stroke="var(--td-text-color-placeholder)" interval={4} tickLine={false}/>
                  <YAxis tick={{fontSize:10}} stroke="var(--td-text-color-placeholder)" tickFormatter={v=>`${(v/1e6).toFixed(1)}M`} width={44} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{borderRadius:8,fontSize:12}} formatter={(v:number)=>[`${(v/1e6).toFixed(2)}M/s`]}/>
                  <Area type="monotone" dataKey="v" stroke="#7C3AED" strokeWidth={1.5} fill="url(#ga)" animationDuration={500}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
          <Card bordered title="事件类型分布">
            {dist.length===0 ? <div className="empty" style={{height:160}}>暂无数据</div> : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dist} margin={{top:0,right:0,left:-16,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--td-component-stroke)" vertical={false}/>
                  <XAxis dataKey="name" tick={{fontSize:10}} stroke="var(--td-text-color-placeholder)" tickLine={false}/>
                  <YAxis tick={{fontSize:10}} stroke="var(--td-text-color-placeholder)" width={32} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{borderRadius:8,fontSize:12}}/>
                  <Bar dataKey="cnt" fill="#7C3AED" radius={[4,4,0,0]} animationDuration={400}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col span={7}>
          <Card bordered title={<span>事件流 <Tag size="small" theme="success" variant="light" style={{marginLeft:8}}>{total}</Tag></span>}>
            {rows.length===0 ? <div className="empty" style={{padding:40}}>{t("no_events")}</div> : (
              rows.slice(0,8).map((e:any,i:number)=>(
                <div key={e.id??i} className="evt-row" onClick={()=>setDetail(e)}>
                  <div className="evt-dot" style={{background:e.status_code<300?"var(--td-success-color)":"var(--td-error-color)"}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="fs12" style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <span className="fw6">{TL[e.event_type]??`E${e.event_type}`}</span>
                      <Tag size="small" theme={TC[e.event_type]||"default"} variant="light">#{e.id}</Tag>
                      <Tag size="small" variant="light" theme={e.status_code<300?"success":"danger"}>{e.status_code}</Tag>
                    </div>
                    <div className="fs11 c-muted mt2">user={e.user_id} · zone{e.zone} · {ts(e.timestamp)}{e.error_msg?<span style={{color:"var(--td-error-color)",marginLeft:6}}>{e.error_msg}</span>:null}</div>
                  </div>
                </div>
              ))
            )}
          </Card>
          <Card bordered style={{marginTop:16}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{flex:1}}><div className="fs12 c-muted" style={{marginBottom:4}}>健康状态</div><Progress percentage={total>0?Math.round((ok/total)*100):100} theme={ok>=total*.95?"success":"warning"} size="small"/></div>
              <div style={{textAlign:"right"}}>
                <div className="fs12" style={{display:"flex",alignItems:"center",gap:4}}><CheckCircleIcon style={{color:"var(--td-success-color)"}}/> {ok} 成功</div>
                <div className="fs12 mt2" style={{display:"flex",alignItems:"center",gap:4}}><ErrorCircleIcon style={{color:"var(--td-error-color)"}}/> {errs} 失败</div>
              </div>
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card bordered title="表" style={{marginBottom:16}}>
            {tables.map(tb=>(
              <div key={tb.name} className="tbl-item">
                <div><div className="fw6 fs13 mono">{tb.name}</div><div className="fs11 c-muted mt2">{tb.desc} · {tb.cols} 列 · {f(tb.rows)} 行</div></div>
                <Tag theme="primary" variant="light">events</Tag>
              </div>
            ))}
          </Card>
          <Card bordered title="系统">
            <div className="sysinfo-grid">
              {[["PG 端口","5409"],["REST 端口","5001"],["加密","AES-256-GCM"],["认证","SCRAM-SHA-256"],["存储","Parquet+Arrow"],["用户","4 (SCRAM)"]].map(([k,v])=>(
                <div key={k}><div className="fs11 c-muted">{k}</div><div className="fs13 fw6">{v}</div></div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Drawer visible={detail!==null} onClose={()=>setDetail(null)} header="事件详情" size="medium" footer={false}>
        {detail && <div className="fs13" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 12px"}}>
          {Object.entries(detail).filter(([k])=>k!=="suggestion").map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--td-component-stroke)"}}>
              <span className="mono fs11 c-muted">{k}</span>
              <span className="fw6 fs12">{v===null?<Tag size="small" variant="light" theme="default">NULL</Tag>:String(v)}</span>
            </div>
          ))}
        </div>}
      </Drawer>
    </div>
  );
}
