import { useState, useCallback, useEffect, useRef } from "react";
import { Card, Button, Space, Table, Tag, MessagePlugin, Textarea, Row, Col } from "tdesign-react";
import { PlayCircleIcon, ClearIcon, DownloadIcon, UploadIcon } from "tdesign-icons-react";
import { queryEvents } from "@/api/events";
import type { QueryResponse } from "@/types/api";

const DEFAULT = "SELECT * FROM events ORDER BY timestamp DESC LIMIT 100;";
const SAMPLES = [
  "SELECT * FROM events ORDER BY timestamp DESC LIMIT 100;",
  "SELECT event_type, COUNT(*) as cnt FROM events GROUP BY event_type ORDER BY cnt DESC;",
  "SELECT * FROM events WHERE event_type = 8 AND status_code >= 400 ORDER BY timestamp DESC;",
  "SELECT zone, COUNT(*) as events FROM events GROUP BY zone ORDER BY zone;",
  "SHOW TABLES;",
  "SHOW USERS;",
  "DESCRIBE events;",
  "SELECT user_id, COUNT(*) as cnt FROM events GROUP BY user_id ORDER BY cnt DESC LIMIT 10;",
];

export function QueryBuilder() {
  const [sql, setSql] = useState(() => String(localStorage.getItem("hunt_sql") || DEFAULT));
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [tables, setTables] = useState<{name:string,cols:number,rows:number}[]>([]);
  const [history, setHistory] = useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem("hunt_sql_history")||"[]")}catch{return[]}});

  const loadTables = useCallback(async()=>{
    try{const r=await queryEvents({sql:"SHOW TABLES"});if(r.columns.includes("table_name"))setTables(r.rows.map((x:any)=>({name:x.table_name,cols:x.columns,rows:x.rows})))}catch{}
  },[]);
  useEffect(()=>{loadTables()},[loadTables]);

  const execute = useCallback(async(querySql?:string|null)=>{
    const raw = typeof querySql==="string"?querySql:sql;
    const q=(raw??"").trim();if(!q)return;
    setLoading(true);setError(null);setSuggestion(null);
    if(typeof querySql==="string")setSql(querySql);
    const t0=performance.now();
    try{
      const res=await queryEvents({sql:q});
      setElapsed(performance.now()-t0);
      if(res.columns.includes("suggestion")&&res.rows.length===1){setError(res.rows[0].error);setSuggestion(res.rows[0].suggestion??null)}
      else{setResult(res);if(q.toUpperCase().includes("SHOW TABLES"))loadTables();localStorage.setItem("hunt_sql",q);setHistory(p=>{const n=[q,...p.filter(h=>h!==q)].slice(0,20);localStorage.setItem("hunt_sql_history",JSON.stringify(n));return n})}
    }catch(err:any){setError(err?.response?.data?.error??err?.message??"查询失败")}
    finally{setLoading(false)}
  },[sql,loadTables]);

  useEffect(()=>{const h=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")execute()};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[execute]);

  const cols = result?.columns?.filter(c=>c!=="suggestion").map(c=>({
    colKey:c,title:c,width:Math.max(c.length*11+40,90),ellipsis:true,
    cell:({row}:any)=>row[c]===null||row[c]===undefined?<Tag size="small" variant="light" theme="default">NULL</Tag>:<span style={{fontFamily:"monospace",fontSize:12}}>{String(row[c])}</span>,
  }))??[];

  const isData = result && !result.columns.includes("suggestion") && !result.columns.includes("result") && !result.columns.includes("error");

  const exportData = (fmt: string) => {
    if(!result||!isData)return;const cols=result.columns.filter(c=>c!=="suggestion");const rows=result.rows as any[];
    let content="",ext="",mime="text/plain";
    if(fmt==="csv"){ext="csv";mime="text/csv";content=cols.join(",")+"\n"+rows.map((r:any)=>cols.map(c=>{const v=r[c];if(v===null||v===undefined)return"";const s=String(v);return s.includes(",")||s.includes('"')||s.includes("\n")?`"${s.replace(/"/g,'""')}"`:s}).join(",")).join("\n")}
    else if(fmt==="json"){ext="json";mime="application/json";content=JSON.stringify(rows.map((r:any)=>{const o:any={};cols.forEach(c=>o[c]=r[c]);return o}),null,2)}
    else if(fmt==="txt"){ext="txt";content=rows.map((r:any)=>cols.map(c=>`${c}: ${r[c]??"NULL"}`).join(" | ")).join("\n")}
    const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`query_result.${ext}`;a.click();URL.revokeObjectURL(url);MessagePlugin.success(`导出 ${fmt.toUpperCase()} (${rows.length} 行)`)
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    const fname = file.name.replace(/\.[^/.]+$/,"").replace(/[^a-zA-Z0-9_]/g,"_");
    const ts = Date.now();
    let rows: any[]=[],cols:string[]=[];
    if(file.name.endsWith(".csv")){
      const lines=text.split("\n").filter(l=>l.trim());if(lines.length<2){MessagePlugin.error("CSV至少需要标题行+数据行");return}
      cols=lines[0].split(",").map(c=>c.trim().replace(/^"|"$/g,""));
      rows=lines.slice(1).map(l=>{const vals:any[]=[];let cur="",inQ=false;for(const ch of l){if(ch==='"')inQ=!inQ;else if(ch===','&&!inQ){vals.push(cur.trim());cur=""}else cur+=ch}vals.push(cur.trim());return vals})
    }else if(file.name.endsWith(".json")){
      const data=JSON.parse(text);const arr=Array.isArray(data)?data:[data];if(arr.length===0){MessagePlugin.error("JSON为空");return}
      cols=Object.keys(arr[0]);rows=arr.map((r:any)=>cols.map(c=>r[c]))
    }else if(file.name.endsWith(".txt")){
      const lines=text.split("\n").filter(l=>l.trim().includes("|"));
      cols=lines[0].split("|").map(c=>c.split(":")[0].trim());
      rows=lines.map(l=>l.split("|").map(p=>p.includes(":")?p.split(":").slice(1).join(":").trim():p.trim()))
    }else{MessagePlugin.error("不支持的文件格式");return}

    const tname = fname + "_" + ts;
    const colDefs = cols.map(c=>`${c} VARCHAR`).join(", ");
    const createSQL = `CREATE TABLE ${tname} (${colDefs})`;
    try{
      await queryEvents({sql:createSQL});MessagePlugin.success(`表 ${tname} 已创建`);
      for(const row of rows){
        const vals = row.map((v:any)=>v===null||v===undefined||String(v).toLowerCase()==="null"?"NULL":`'${String(v).replace(/'/g,"''")}'`).join(", ");
        await queryEvents({sql:`INSERT INTO ${tname} VALUES (${vals})`});
      }
      MessagePlugin.success(`导入完成: ${rows.length} 行 → ${tname}`);
      loadTables();
    }catch(err:any){MessagePlugin.error(`导入失败: ${err?.message||err}`)}
  };

  const fileRef = useRef<HTMLInputElement>(null);

  return(<div>
    <input type="file" accept=".csv,.json,.txt" style={{display:"none"}} ref={fileRef} onChange={e=>{const f=(e.target as HTMLInputElement).files?.[0];if(f){importFile(f);e.target.value=""}}}/>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <h2 style={{margin:0,fontSize:16,fontWeight:700}}>SQL 查询构建器</h2>
      <Space>{tables.map(t=><Tag key={t.name} style={{cursor:"pointer"}} size="medium" variant="light" theme="primary" onClick={()=>execute(`SELECT * FROM ${t.name} LIMIT 30`)}>{t.name}<span style={{marginLeft:4,opacity:.6,fontSize:10}}>{t.rows??0}</span></Tag>)}<Button size="small" variant="outline" icon={<UploadIcon/>} onClick={()=>fileRef.current?.click()}>导入</Button></Space>
    </div>

    <Card bordered style={{marginBottom:16}}>
      <Textarea value={String(sql??"")} onChange={v=>{setSql(String(v??""));setError(null)}} placeholder="SQL ... Ctrl+Enter 执行" autosize={{minRows:5,maxRows:14}} style={{fontFamily:"monospace",fontSize:13,lineHeight:1.6}}/>
      {error&&<div style={{marginTop:8,padding:"8px 12px",borderRadius:6,background:"var(--td-warning-color-1)",border:"1px solid var(--td-warning-color-3)",fontSize:12}}>{error}{suggestion?<span> · <span onClick={()=>execute(suggestion)} style={{cursor:"pointer",color:"var(--td-brand-color)",fontWeight:600,fontFamily:"monospace"}}>{suggestion}</span></span>:null}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
        <Space>
          <Button theme="primary" icon={<PlayCircleIcon/>} loading={loading} onClick={()=>execute()}>Ctrl+Enter</Button>
          <Button variant="outline" icon={<ClearIcon/>} onClick={()=>{setSql("");setResult(null);setError(null)}}>清除</Button>
        </Space>
        <Space>
          {SAMPLES.slice(0,5).map((s,i)=><Button key={i} size="small" variant="text" onClick={()=>{setSql(s);execute(s)}}>{s.length>25?s.slice(0,25)+"…":s}</Button>)}
        </Space>
        {isData&&<Tag theme="success" variant="light">{result.rows.length} 行 · {elapsed.toFixed(1)}ms</Tag>}
      </div>
    </Card>

    {/* History chips */}
    {history.length>0&&<div style={{marginBottom:12,display:"flex",gap:6,flexWrap:"wrap"}}>
      {history.slice(0,8).map((h,i)=><Tag key={i} size="small" style={{cursor:"pointer",maxWidth:300}} onClick={()=>setSql(h)}>{h.replace(/\n/g," ").slice(0,50)}</Tag>)}
    </div>}

    {result && result.columns.includes("result") && !result.columns.includes("suggestion") && (
      <Card bordered style={{marginBottom:16}}>{result.rows.map((r:any,i:number)=><div key={i} style={{fontSize:13,color:r.error?"var(--td-error-color)":"var(--td-success-color)"}}>{r.result??r.error}</div>)}</Card>
    )}
    {isData && (
      <Card bordered title={`结果 · ${result.columns.length} 列`} actions={<Space size={4}>{["csv","json","txt"].map(f=><Button key={f} size="small" variant="outline" icon={<DownloadIcon/>} onClick={()=>exportData(f)}>.{f}</Button>)}</Space>}>
        <Table data={result.rows} columns={cols} rowKey={(_:any,i:number)=>String(i)} maxHeight={500} bordered stripe hover size="small" empty="0 行" pagination={{defaultPageSize:50,pageSizeOptions:[20,50,100,200],showJumper:true}}/>
      </Card>
    )}
  </div>);
}
