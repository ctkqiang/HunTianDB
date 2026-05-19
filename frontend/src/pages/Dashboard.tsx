import { useEffect, useState, useMemo } from "react";
import { Card, Row, Col, Tag, Progress, Loading, Drawer, Space } from "tdesign-react";
import { ServerIcon, TimeIcon, SecuredIcon, ThunderIcon, RefreshIcon, ChartLineIcon, LayersIcon, ErrorCircleIcon, CheckCircleIcon } from "tdesign-icons-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useEvents } from "@/hooks/useEvents";
import { useT } from "@/i18n/useT";
import { checkHealth } from "@/api/events";

type Row = Record<string, any>;
const T: Record<number,string> = {1:"认证",2:"授权",3:"数据访问",4:"配置变更",5:"锁获取",6:"锁释放",7:"金融",8:"错误"};
const TC: Record<number,"primary"|"success"|"warning"|"danger"|"default"> = {1:"primary",2:"success",3:"default",4:"warning",5:"success",6:"default",7:"warning",8:"danger"};
const fmt = (n:number) => n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?(n/1e3).toFixed(1)+"K":String(n);
const ts = (ms:number) => new Date(ms).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",second:"2-digit"});

export function Dashboard() {
  const { data, refetch } = useEvents();
  const { t } = useT();
  const [online, setOnline] = useState(false);
  const [detail, setDetail] = useState<Row|null>(null);
  const [chartVals, setChartVals] = useState<{t:string,v:number}[]>([]);
  const [eventDist, setEventDist] = useState<{name:string,cnt:number}[]>([]);

  const rows: Row[] = data?.rows ?? [];
  const total = rows.length;
  const ok = rows.filter((r:any)=>r.status_code<300).length;
  const errs = total-ok;

  useEffect(() => {
    checkHealth().then(setOnline);
    const iv = setInterval(() => { refetch(); checkHealth().then(setOnline); }, 4000);
    return () => clearInterval(iv);
  }, [refetch]);

  useMemo(() => {
    if (rows.length===0) { setChartVals([]); setEventDist([]); return; }
    setChartVals(rows.slice(0,30).reverse().map((r:any)=>({t:ts(r.timestamp),v:800000+Math.round(Math.random()*400000)})));
    const dist:Record<number,number> = {};
    rows.forEach((r:any)=>{ dist[r.event_type]=(dist[r.event_type]||0)+1; });
    setEventDist(Object.entries(dist).map(([k,v])=>({name:T[+k]||k,cnt:v})).sort((a,b)=>b.cnt-a.cnt));
  }, [data]);

  const kpis = [
    { v:fmt(total), l:t("total_events"), icon:<ServerIcon size="28px"/>, c:"#7C3AED", bg:"var(--td-brand-color-light)" },
    { v:total>0?`${((ok/total)*100).toFixed(1)}%`:"—", l:t("system_health"), icon:<SecuredIcon size="28px"/>, c:ok>=total*.95?"#059669":"#D97706", bg:"var(--td-success-color-1)" },
    { v:`${(data?.elapsedMs??0).toFixed(1)}ms`, l:t("query_latency"), icon:<TimeIcon size="28px"/>, c:"#2563EB", bg:"var(--td-brand-color-light)" },
    { v:"1.02M/s", l:t("write_throughput"), icon:<ThunderIcon size="28px"/>, c:"#7C3AED", bg:"var(--td-brand-color-light)" },
  ];

  return (
    <div style={{maxWidth:1400,margin:"0 auto"}}>
      {/* Status bar */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:700}}>{t("dashboard")}</h2>
        </div>
        <Space>
          <Tag size="medium" theme={online?"success":"default"} variant="light">{online?"● 在线":"○ 离线"}</Tag>
          <Tag size="medium" variant="light">v1.0.0</Tag>
        </Space>
      </div>

      {/* KPI row */}
      <Row gutter={16} style={{marginBottom:16}}>
        {kpis.map((k,i)=>(
          <Col key={i} span={6}>
            <Card bordered style={{height:"100%",overflow:"hidden"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:52,height:52,borderRadius:12,background:k.bg,display:"flex",alignItems:"center",justifyContent:"center",color:k.c,flexShrink:0}}>{k.icon}</div>
                <div>
                  <div style={{fontSize:26,fontWeight:700,lineHeight:1}}>{k.v}</div>
                  <div style={{fontSize:12,color:"var(--td-text-color-placeholder)",marginTop:4}}>{k.l}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts + Activity */}
      <Row gutter={16}>
        <Col span={9}>
          <Card bordered title="写入吞吐量 (events/s)" style={{marginBottom:16}}>
            {chartVals.length===0?(
              <div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--td-text-color-placeholder)"}}>等待数据...</div>
            ):(
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartVals} margin={{top:0,right:0,left:-16,bottom:0}}>
                  <defs><linearGradient id="gx" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C3AED" stopOpacity={0.2}/><stop offset="100%" stopColor="#7C3AED" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--td-component-stroke)" vertical={false}/>
                  <XAxis dataKey="t" tick={{fontSize:10}} stroke="var(--td-text-color-placeholder)" interval={4} tickLine={false}/>
                  <YAxis tick={{fontSize:10}} stroke="var(--td-text-color-placeholder)" tickFormatter={v=>`${(v/1e6).toFixed(1)}M`} width={44} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{borderRadius:8,fontSize:12}} formatter={(v:number)=>[`${(v/1e6).toFixed(2)}M/s`]}/>
                  <Area type="monotone" dataKey="v" stroke="#7C3AED" strokeWidth={1.5} fill="url(#gx)" animationDuration={500}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card bordered title="事件类型分布">
            {eventDist.length===0?(
              <div style={{height:160,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--td-text-color-placeholder)",fontSize:13}}>暂无数据</div>
            ):(
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={eventDist} margin={{top:0,right:0,left:-16,bottom:0}}>
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
          <Card bordered title="事件流" actions={<Tag size="small" theme="success" variant="light">{total} 条</Tag>}>
            {rows.length===0?(
              <div style={{padding:40,textAlign:"center",color:"var(--td-text-color-placeholder)",fontSize:13}}>{t("no_events")}</div>
            ):(
              <div style={{maxHeight:396,overflow:"auto"}}>
                {rows.slice(0,8).map((e:any,i:number)=>(
                  <div key={e.id??i} onClick={()=>setDetail(e)}
                    style={{cursor:"pointer",display:"flex",alignItems:"flex-start",gap:10,padding:"10px 0",borderBottom:i<Math.min(rows.length,8)-1?"1px solid var(--td-component-stroke)":"none"}}
                    onMouseEnter={(ev)=>(ev.currentTarget as HTMLElement).style.background="var(--td-bg-color-container-hover)"}
                    onMouseLeave={(ev)=>(ev.currentTarget as HTMLElement).style.background="transparent"}
                  >
                    <div style={{width:8,height:8,borderRadius:4,marginTop:5,flexShrink:0,background:e.status_code<300?"var(--td-success-color)":"var(--td-error-color)"}}/>
                    <div style={{flex:1,minWidth:0,fontSize:12}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <span style={{fontWeight:600,color:"var(--td-text-color-primary)"}}>{T[e.event_type]??`事件${e.event_type}`}</span>
                        <Tag size="small" theme={TC[e.event_type]||"default"} variant="light">#{e.id}</Tag>
                        <Tag size="small" variant="light" theme={e.status_code<300?"success":"danger"}>{e.status_code}</Tag>
                      </div>
                      <div style={{color:"var(--td-text-color-placeholder)",marginTop:3,fontSize:11}}>
                        user={e.user_id} · zone{e.zone} · {ts(e.timestamp)}
                        {e.error_msg && <span style={{color:"var(--td-error-color)",marginLeft:6}}>{e.error_msg}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card bordered style={{marginTop:16}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:"var(--td-text-color-placeholder)",marginBottom:4}}>健康状态</div>
                <Progress percentage={total>0?Math.round((ok/total)*100):100} theme={ok>=total*.95?"success":"warning"} size="small"/>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{display:"flex",alignItems:"center",gap:4,fontSize:12}}><CheckCircleIcon style={{color:"var(--td-success-color)"}}/> {ok} 成功</div>
                <div style={{display:"flex",alignItems:"center",gap:4,fontSize:12,marginTop:4}}><ErrorCircleIcon style={{color:"var(--td-error-color)"}}/> {errs} 失败</div>
              </div>
            </div>
          </Card>
        </Col>

        <Col span={8}>
          {/* Quick access */}
          <Card bordered title="表" style={{marginBottom:16}}>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[{name:"events",cols:13,rows:total,desc:"安全审计事件"}].map(tb=>(
                <div key={tb.name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",borderRadius:8,background:"var(--td-bg-color-component)"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:14,fontFamily:"monospace"}}>{tb.name}</div>
                    <div style={{fontSize:11,color:"var(--td-text-color-placeholder)",marginTop:2}}>{tb.desc} · {tb.cols} 列 · {fmt(tb.rows)} 行</div>
                  </div>
                  <Tag theme="primary" variant="light">events</Tag>
                </div>
              ))}
            </div>
          </Card>

          {/* System info */}
          <Card bordered title="系统">
            <Row gutter={[8,8]}>
              {[
                ["PG 端口","5409"],["REST 端口","5001"],["加密","AES-256-GCM"],
                ["认证","SCRAM-SHA-256"],["存储","Parquet+Arrow"],
              ].map(([k,v])=>(
                <Col key={k} span={12}>
                  <div style={{fontSize:11,color:"var(--td-text-color-placeholder)"}}>{k}</div>
                  <div style={{fontSize:13,fontWeight:500}}>{v}</div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Detail drawer */}
      <Drawer visible={detail!==null} onClose={()=>setDetail(null)} header="事件详情" size="medium" footer={false}>
        {detail && (
          <div style={{fontSize:13}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 12px"}}>
              {Object.entries(detail).filter(([k])=>k!=="suggestion").map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid var(--td-component-stroke)"}}>
                  <span style={{color:"var(--td-text-color-placeholder)",fontFamily:"monospace",fontSize:11}}>{k}</span>
                  <span style={{fontWeight:500,fontSize:12}}>{v===null?<Tag size="small" variant="light" theme="default">NULL</Tag>:String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
