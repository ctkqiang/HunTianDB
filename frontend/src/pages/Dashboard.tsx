import { useEffect, useState, useMemo } from "react";
import { Card, Row, Col, Tag, Progress, Drawer, Space } from "tdesign-react";
import { ServerIcon, SecuredIcon, ThunderIcon, CheckCircleIcon, ErrorCircleIcon } from "tdesign-icons-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useEvents } from "@/hooks/useEvents";
import { useT } from "@/i18n/useT";
import { checkHealth } from "@/api/events";

type R=Record<string,any>;
const TL:Record<number,string>={1:"认证",2:"授权",3:"数据访问",4:"配置变更",5:"锁获取",6:"锁释放",7:"金融",8:"错误"};
const TC:Record<number,"primary"|"success"|"warning"|"danger"|"default">={1:"primary",2:"success",3:"default",4:"warning",5:"success",6:"default",7:"warning",8:"danger"};
const nf=(n:number)=>n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?(n/1e3).toFixed(1)+"K":String(n);
const tfl=(ms:number,locale:string)=>new Date(ms).toLocaleTimeString(locale==="zh"?"zh-CN":"en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"});

export function Dashboard() {
  const {data,refetch}=useEvents();const {t,lang}=useT();
  const [online,setOnline]=useState(false);const [detail,setDetail]=useState<R|null>(null);
  const [chart,setChart]=useState<{t:string,v:number}[]>([]);const [dist,setDist]=useState<{name:string,cnt:number}[]>([]);
  const rows:R[]=data?.rows??[];const total=rows.length,ok=rows.filter((r:any)=>r.status_code<300).length,errs=total-ok;

  useEffect(()=>{checkHealth().then(setOnline);const iv=setInterval(()=>{refetch();checkHealth().then(setOnline);},4000);return()=>clearInterval(iv);},[refetch]);
  useMemo(()=>{
    if(!total){setChart([]);setDist([]);return;}
    // Real data: group events by minute from actual timestamps
    const bins:Record<string,number>={};
    let tMin=Infinity,tMax=0;
    rows.forEach((r:any)=>{const k=tfl(r.timestamp,lang).slice(0,5);bins[k]=(bins[k]||0)+1;const ts=r.timestamp;if(ts<tMin)tMin=ts;if(ts>tMax)tMax=ts;});
    setChart(Object.entries(bins).sort().map(([k,v])=>({t:k,v})));
    const d:Record<number,number>={};rows.forEach((r:any)=>{d[r.event_type]=(d[r.event_type]||0)+1});setDist(Object.entries(d).map(([k,v])=>({name:TL[+k]||k,cnt:v})).sort((a,b)=>b.cnt-a.cnt));
  },[data]);

  const eps=total>0&&data?.elapsedMs?Math.round(total/(data.elapsedMs/1000)):0;
  const kpis=[{v:nf(total),l:t("total_events"),icon:<ServerIcon/>,c:"#8B5CF6",bg:"var(--td-brand-color-light)"},{v:total>0?`${((ok/total)*100).toFixed(1)}%`:"—",l:t("system_health"),icon:<SecuredIcon/>,c:ok>=total*.95?"#34D399":"#FBBF24",bg:ok>=total*.95?"var(--td-success-color-1)":"var(--td-warning-color-1)"},{v:`${(data?.elapsedMs??0).toFixed(1)}ms`,l:t("query_latency"),icon:<ThunderIcon/>,c:"#60A5FA",bg:"var(--td-brand-color-light)"},{v:eps>0?`${nf(eps)}/s`:"—",l:t("write_throughput"),icon:<ThunderIcon/>,c:"#8B5CF6",bg:"var(--td-brand-color-light)"}];

  return(<div style={{maxWidth:1400,margin:"0 auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,paddingTop:4}}>
      <h2 style={{margin:0,fontSize:16,fontWeight:700}}>{t("dashboard")}</h2>
      <Space><Tag size="medium" theme={online?"success":"default"} variant="light">{t(online?"online":"offline")}</Tag><Tag size="medium" variant="light">v1.0</Tag></Space>
    </div>

    <Row gutter={[16,16]} style={{marginBottom:16}}>
      {kpis.map((k,i)=>(<Col key={i} span={6}><Card bordered style={{height:"100%"}}><div className="kpi-card"><div className="kpi-icon" style={{background:k.bg,color:k.c}}>{k.icon}</div><div><div className="kpi-value">{k.v}</div><div className="kpi-label">{k.l}</div></div></div></Card></Col>))}
    </Row>

    <Row gutter={[16,16]}>
      <Col span={14}>
        <Row gutter={[12,12]}>
          <Col span={12}>
            <Card bordered title={t("write_throughput")} style={{height:"100%"}}>
              {chart.length===0?<div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--td-text-color-placeholder)",fontSize:13}}>等待数据 ...</div>:
              <ResponsiveContainer width="100%" height={200}><AreaChart data={chart} margin={{top:4,right:4,left:-12,bottom:0}}><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity={.15}/><stop offset="100%" stopColor="#8B5CF6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="var(--td-component-stroke)" vertical={false}/><XAxis dataKey="t" tick={{fontSize:9}} stroke="var(--td-text-color-placeholder)" interval={5} tickLine={false}/><YAxis tick={{fontSize:9}} stroke="var(--td-text-color-placeholder)" width={32} axisLine={false} tickLine={false}/><Tooltip contentStyle={{borderRadius:8,fontSize:11}} formatter={(v:number)=>[`${v} events`]}/><Area type="monotone" dataKey="v" stroke="#8B5CF6" strokeWidth={1.5} fill="url(#ga)" animationDuration={400}/></AreaChart></ResponsiveContainer>}
            </Card>
          </Col>
          <Col span={12}>
            <Card bordered title={t("event_distribution")} style={{height:"100%"}}>
              {dist.length===0?<div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--td-text-color-placeholder)",fontSize:13}}>暂无数据</div>:
              <ResponsiveContainer width="100%" height={200}><BarChart data={dist} margin={{top:4,right:4,left:-12,bottom:0}}><CartesianGrid strokeDasharray="3 3" stroke="var(--td-component-stroke)" vertical={false}/><XAxis dataKey="name" tick={{fontSize:9}} stroke="var(--td-text-color-placeholder)" tickLine={false}/><YAxis tick={{fontSize:9}} stroke="var(--td-text-color-placeholder)" width={28} axisLine={false} tickLine={false}/><Tooltip contentStyle={{borderRadius:8,fontSize:11}}/><Bar dataKey="cnt" fill="#8B5CF6" radius={[3,3,0,0]} animationDuration={400}/></BarChart></ResponsiveContainer>}
            </Card>
          </Col>
        </Row>
        <Card bordered title={<span>{t("event_stream")}<Tag size="small" theme="success" variant="light" style={{marginLeft:8}}>{total}</Tag></span>} style={{marginTop:12}}>
          {rows.length===0?<div style={{padding:60,textAlign:"center",color:"var(--td-text-color-placeholder)",fontSize:13}}>{t("no_events")}</div>:
          <div style={{maxHeight:436,overflow:"auto"}}>
            {rows.slice(0,12).map((e:any,i:number)=>(<div key={e.id??i} className="event-feed-item" onClick={()=>setDetail(e)}>
              <div style={{width:6,height:6,borderRadius:3,marginTop:6,flexShrink:0,background:e.status_code<300?"var(--td-success-color)":"var(--td-error-color)"}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}><span style={{fontSize:12,fontWeight:600}}>{TL[e.event_type]??`E${e.event_type}`}</span><Tag size="small" theme={TC[e.event_type]||"default"} variant="light">#{e.id}</Tag><Tag size="small" variant="light" theme={e.status_code<300?"success":"danger"}>{e.status_code}</Tag></div>
                <div style={{fontSize:11,color:"var(--td-text-color-placeholder)",marginTop:2}}>user={e.user_id} · zone{e.zone} · {tf(e.timestamp)}{e.error_msg?<span style={{color:"var(--td-error-color)",marginLeft:6}}>{e.error_msg}</span>:null}</div>
              </div>
            </div>))}
          </div>}
        </Card>
      </Col>
    </Row>

    <Drawer visible={detail!==null} onClose={()=>setDetail(null)} header={t("event_detail")} size="medium" placement="right" footer={false} closeBtn={false}>
      {detail&&(()=>{
        const f=(k:string)=>detail[k];
        const ip=(n:number)=>`${(n>>>24)&0xFF}.${(n>>>16)&0xFF}.${(n>>>8)&0xFF}.${n&0xFF}`;
        const loc = (ms:number)=>new Date(ms).toLocaleString(lang==="zh"?"zh-CN":"en-US");
        const fields:([string,any])[]=[
          [t("field_id"),f("id")],[t("field_event_type"),<Tag size="small" theme={TC[f("event_type")]||"default"} variant="light">{TL[f("event_type")]||f("event_type")}</Tag>],
          [t("field_timestamp"),loc(f("timestamp"))],
          [t("field_user_id"),f("user_id")],[t("field_session_id"),f("session_id")],[t("field_ip"),ip(f("ip_address"))],
          [t("field_zone"),f("zone")],[t("field_region"),f("region")],
          [t("field_status"),<Tag size="small" theme={f("status_code")<300?"success":"danger"} variant="light">{f("status_code")}</Tag>],
          [t("field_lock_id"),f("lock_id")],[t("field_parent"),f("parent_event_id")||"—"],
        ];
        if(f("error_msg"))fields.push([t("field_error_msg"),<span style={{color:"var(--td-error-color)"}}>{f("error_msg")}</span>]);
        if(f("metadata_json"))fields.push([t("field_metadata"),<code style={{fontSize:11}}>{f("metadata_json")}</code>]);
        return(<div style={{display:"flex",flexDirection:"column"}}>
          {fields.map(([k,v],i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"1px solid var(--td-component-stroke)",fontSize:13}}><span style={{color:"var(--td-text-color-placeholder)",flexShrink:0}}>{k}</span><span style={{fontWeight:600,fontFamily:"monospace",textAlign:"right",marginLeft:16}}>{v}</span></div>))}
        </div>);
      })()}
    </Drawer>
  </div>);
}
