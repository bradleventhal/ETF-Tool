"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { TickerInput } from "@/components/ticker-input"
import { ComparisonTable } from "@/components/comparison-table"
import { PerformanceChart } from "@/components/performance-chart"
import { GrowthChart } from "@/components/growth-chart"
import { SectorPieChart } from "@/components/sector-pie-chart"
import { IncomeBars, RiskTable } from "@/components/income-risk-bars"
import { FileUpload } from "@/components/file-upload"
import { parseFile } from "@/lib/parse-fund-data"
import { saveFunds } from "@/lib/fund-store"
import { runAnalysis } from "@/lib/analysis-engine"
import { buildWarRoom } from "@/lib/competitor-pitch"
import { CompetitorWarRoom } from "@/components/competitor-war-room"
import { FundChat } from "@/components/fund-chat"
import { ElevatorPitch } from "@/components/elevator-pitch"
import { FundLookup } from "@/components/fund-lookup"
import {
  ScatterChart, Scatter, XAxis as RXAxis, YAxis as RYAxis, CartesianGrid,
  ResponsiveContainer, Tooltip as RTooltip, ZAxis, Cell, ReferenceLine, Label,
} from "recharts"
import { SlidersHorizontal } from "lucide-react"
import type { FundData, AnalysisMode, AnalysisResult, WarRoom, YahooAnalytics } from "@/lib/fund-types"
import { Upload, X, Loader2, ArrowRightLeft, Search, BarChart3, Crosshair, Star } from "lucide-react"

function NegTable({ rows, tickerA, tickerB, label, viewMode }: {
  rows: { label: string; a: string; b: string; nA: number | null; nB: number | null }[]
  tickerA: string; tickerB: string; label: string; viewMode: "internal" | "advisor"
}) {
  const hasAnyNeg = rows.some(r => (r.nA != null && r.nA < -0.001) || (r.nB != null && r.nB < -0.001))
  const hasLargeNeg = rows.some(r => (r.nA != null && r.nA < -0.099) || (r.nB != null && r.nB < -0.099))
  const showNote = viewMode === "internal" ? hasAnyNeg : hasLargeNeg
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: "#f8fafc" }}>
            <th className="px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wider sm:px-4" style={{ color: "#94a3b8" }}>{label}</th>
            <th className="px-2.5 py-2 text-right font-mono text-[11px] font-bold sm:px-4" style={{ color: "#0f3d6b" }}>{tickerA}</th>
            <th className="px-2.5 py-2 text-right font-mono text-[11px] font-bold sm:px-4" style={{ color: "#64748b" }}>{tickerB}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const nA = r.nA != null ? r.nA : 0
            const nB = r.nB != null ? r.nB : 0
            return (
              <tr key={r.label} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: i < rows.length - 1 ? "1px solid #f1f5f9" : undefined }}>
                <td className="px-2.5 py-1.5 text-[12px] sm:px-4 sm:text-[13px]" style={{ color: "#64748b" }}>{r.label}</td>
                <td className="px-2.5 py-1.5 text-right font-mono text-[12px] sm:px-4 sm:text-[13px]" style={{ color: nA < -0.001 ? "#dc2626" : "#334155", fontWeight: nA < -0.001 ? 700 : 400 }}>{r.a}</td>
                <td className="px-2.5 py-1.5 text-right font-mono text-[12px] sm:px-4 sm:text-[13px]" style={{ color: nB < -0.001 ? "#dc2626" : "#334155", fontWeight: nB < -0.001 ? 700 : 400 }}>{r.b}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {showNote && (
        <div className="px-2.5 py-2 text-right sm:px-4">
          <span className="text-[11px] italic" style={{ color: "#dc2626" }}>
            {"* Negative allocation implies utilization of leverage"}
          </span>
        </div>
      )}
    </div>
  )
}

function PieWithTable({ title, dataA, dataB, tickerA, tickerB, subtitleA, subtitleB, rows, rowLabel, viewMode }: {
  title: string
  dataA: { name: string; value: number }[]
  dataB: { name: string; value: number }[]
  tickerA: string; tickerB: string
  subtitleA?: string; subtitleB?: string
  rows: { label: string; a: string; b: string; nA: number | null; nB: number | null }[]
  rowLabel: string
  viewMode: "internal" | "advisor"
}) {
  return (
    <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
      <div className="border-b px-3 py-2.5 sm:px-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
        <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>{title}</h4>
      </div>
      <div className="grid grid-cols-1 gap-0 md:grid-cols-2">
        <div className="border-b p-3 sm:p-4 md:border-b-0 md:border-r" style={{ borderColor: "#f1f5f9" }}>
          <SectorPieChart data={dataA} ticker={tickerA} subtitle={subtitleA} mode={viewMode} />
        </div>
        <div className="p-3 sm:p-4">
          <SectorPieChart data={dataB} ticker={tickerB} subtitle={subtitleB} mode={viewMode} />
        </div>
      </div>
      <div className="border-t" style={{ borderColor: "#f1f5f9" }}>
        <NegTable rows={rows} tickerA={tickerA} tickerB={tickerB} label={rowLabel} viewMode={viewMode} />
      </div>
    </div>
  )
}

/* ═══ CREDIT HELPERS ═══ */
const MAP_CREDIT_LABELS = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC", "Below CCC"]
function creditScore(f: FundData): number | null {
  const w: [keyof FundData, number][] = [["aaa",1],["aa",2],["a",3],["bbb",4],["bb",5],["b",6],["ccc",7],["belowCcc",8]]
  let total = 0, sumW = 0
  for (const [k, s] of w) { const v = f[k] as number | null; if (v != null && v > 0) { total += s * v; sumW += v } }
  return sumW > 0 ? total / sumW : null
}
function creditLabel(score: number): string { const i = Math.round(score) - 1; return MAP_CREDIT_LABELS[i] ?? score.toFixed(1) }

/* ═══ AXIS SYSTEM ═══ */
type MapAxisKey = "duration"|"ytwYtm"|"secYield"|"expense"|"sharpe"|"stdDev"|"credit"|"ytd"|"oneYear"|"threeYear"|"correlation"|"morningstarRating"
interface MapAxisOption { key: MapAxisKey; label: string; isCredit: boolean; format: (v:number)=>string; tickFmt: (v:number)=>string; getValue: (f:FundData)=>number|null }
const mfp = (v:number) => `${v.toFixed(2)}%`
const mfn = (v:number) => v.toFixed(2)
const MAP_AXES: MapAxisOption[] = [
  { key:"duration", label:"Duration (yrs)", isCredit:false, format:v=>`${v.toFixed(2)} yrs`, tickFmt:mfn, getValue:f=>f.duration },
  { key:"ytwYtm", label:"YTW / YTM", isCredit:false, format:mfp, tickFmt:mfp, getValue:f=>f.ytwYtm },
  { key:"secYield", label:"SEC Yield", isCredit:false, format:mfp, tickFmt:mfp, getValue:f=>f.secYield },
  { key:"expense", label:"Expense Ratio", isCredit:false, format:mfp, tickFmt:mfp, getValue:f=>f.expense },
  { key:"sharpe", label:"Sharpe Ratio", isCredit:false, format:mfn, tickFmt:mfn, getValue:f=>f.sharpe },
  { key:"stdDev", label:"Std Dev", isCredit:false, format:mfn, tickFmt:mfn, getValue:f=>f.stdDev },
  { key:"credit", label:"Credit Quality", isCredit:true, format:v=>creditLabel(v), tickFmt:v=>{const r=Math.round(v);return r>=1&&r<=8?creditLabel(r):""}, getValue:f=>creditScore(f) },
  { key:"ytd", label:"YTD Return", isCredit:false, format:mfp, tickFmt:mfp, getValue:f=>f.ytd },
  { key:"oneYear", label:"1Y Return", isCredit:false, format:mfp, tickFmt:mfp, getValue:f=>f.oneYear },
  { key:"threeYear", label:"3Y Return", isCredit:false, format:mfp, tickFmt:mfp, getValue:f=>f.threeYear },
  { key:"correlation", label:"Correlation", isCredit:false, format:mfn, tickFmt:mfn, getValue:f=>f.correlation },
  { key:"morningstarRating", label:"Star Rating", isCredit:false, format:v=>`${v.toFixed(0)}\u2605`, tickFmt:v=>Number.isInteger(v)?`${v}\u2605`:"", getValue:f=>f.morningstarRating },
]
const findMapAxis = (key: MapAxisKey) => MAP_AXES.findIndex(a => a.key === key)
const MAP_PRESETS = [
  { label:"Yield vs Duration", x:"duration" as MapAxisKey, y:"ytwYtm" as MapAxisKey, insight:"Shows yield pickup per unit of interest rate risk -- are you getting paid enough for the duration you're taking?" },
  { label:"Yield vs Credit", x:"credit" as MapAxisKey, y:"ytwYtm" as MapAxisKey, insight:"Reveals whether higher yield comes from credit risk -- funds to the left offer higher quality at comparable yields." },
]
const MAP_DUR_CATS = [{label:"Ultra-Short (0\u20131 yr)",min:0,max:1},{label:"Short (1\u20133.5 yrs)",min:1,max:3.5},{label:"Intermediate (3.5\u20136 yrs)",min:3.5,max:6},{label:"Long (6+ yrs)",min:6,max:100}]
const MAP_MSTAR_CATS = ["Nontraditional Bond","Multisector Bond","Short-Term Bond","Ultrashort Bond","High Yield Bond","Intermediate Core Bond","Intermediate Core-Plus Bond","Corporate Bond","Intermediate Government","Bank Loan","Emerging Markets Bond","Preferred Stock","Long-Term Bond"]
const MAP_PRI = "#0f3d6b", MAP_HL = "#dc2626", MAP_DOT = "#3b82f6"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MapDot(props: any) {
  const { cx, cy, payload, hoveredTicker, onHover, onLeave, onClick } = props
  if (cx == null || cy == null || !payload || isNaN(cx) || isNaN(cy)) return null
  const isH = hoveredTicker === payload.ticker
  const r = isH ? 7 : 4.5
  return (
    <g onMouseEnter={() => onHover(payload.ticker)} onMouseLeave={onLeave} onClick={() => onClick?.(payload.ticker)} style={{ cursor: onClick ? "pointer" : "default" }}>
      <circle cx={cx} cy={cy} r={r + 6} fill="transparent" />
      <circle cx={cx} cy={cy} r={r} fill={payload.isHighlighted ? MAP_HL : MAP_DOT} stroke="#fff" strokeWidth={1.5} opacity={isH ? 1 : 0.75} style={{ transition: "r 0.15s, opacity 0.15s" }} />
      {isH && (<><rect x={cx - 20} y={cy - 22} width={40} height={16} rx={3} fill={MAP_PRI} opacity={0.9} /><text x={cx} y={cy - 11} textAnchor="middle" fill="#fff" fontSize={9} fontWeight={700}>{payload.ticker}</text></>)}
    </g>
  )
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MapTip({ active, payload }: any) {
  if (!active || !payload?.[0]?.payload) return null
  const d = payload[0].payload
  const fp = (v: number|null) => v != null ? `${v.toFixed(2)}%` : "\u2014"
  const fn = (v: number|null) => v != null ? v.toFixed(2) : "\u2014"
  const stats = [{label:"YTW / YTM",value:fp(d.ytwYtm)},{label:"SEC Yield",value:fp(d.secYield)},{label:"Duration",value:d.duration!=null?`${d.duration.toFixed(2)} yrs`:"\u2014"},{label:"Credit",value:d.creditQuality??"\u2014"},{label:"Expense",value:fp(d.expense)},{label:"Sharpe",value:fn(d.sharpe)},{label:"Std Dev",value:fn(d.stdDev)}].filter(s=>s.value!=="\u2014")
  const perf = [{label:"YTD",value:fp(d.ytd)},{label:"1Y",value:fp(d.oneYear)},{label:"3Y",value:fp(d.threeYear)}].filter(s=>s.value!=="\u2014")
  return (
    <div className="rounded-lg border px-3 py-2.5 shadow-lg" style={{backgroundColor:"#fff",borderColor:"#e2e8f0",minWidth:210}}>
      <div className="flex items-center gap-2"><span className="text-xs font-bold" style={{color:MAP_PRI}}>{d.ticker}</span>{d.morningstarRating!=null&&d.morningstarRating>0&&<span className="text-[10px]" style={{color:"#f59e0b"}}>{"\u2605".repeat(d.morningstarRating)}</span>}</div>
      <div className="text-[10px] leading-snug" style={{color:"#64748b"}}>{d.name}</div>
      {d.morningstarCategory&&<div className="mt-0.5 text-[9px] font-medium" style={{color:"#94a3b8"}}>{d.morningstarCategory}</div>}
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 border-t pt-1.5" style={{borderColor:"#f1f5f9"}}>{stats.map(s=>(<div key={s.label} className="flex items-baseline justify-between gap-2"><span className="text-[9px]" style={{color:"#94a3b8"}}>{s.label}</span><span className="text-[10px] font-semibold tabular-nums" style={{color:"#334155"}}>{s.value}</span></div>))}</div>
      {perf.length>0&&<div className="mt-1 flex gap-3 border-t pt-1" style={{borderColor:"#f1f5f9"}}>{perf.map(s=>(<div key={s.label} className="flex items-baseline gap-1"><span className="text-[9px]" style={{color:"#94a3b8"}}>{s.label}</span><span className="text-[10px] font-semibold tabular-nums" style={{color:"#334155"}}>{s.value}</span></div>))}</div>}
    </div>
  )
}

function InlineFundMap({ funds, onSelectFund }: { funds: FundData[]; onSelectFund?: (t: string) => void }) {
  const [presetIdx, setPresetIdx] = useState(0)
  const [xIdx, setXIdx] = useState(findMapAxis("duration"))
  const [yIdx, setYIdx] = useState(findMapAxis("ytwYtm"))
  const xAxis = MAP_AXES[xIdx]
  const yAxis = MAP_AXES[yIdx]
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [durationCats, setDurationCats] = useState<Set<string>>(new Set(MAP_DUR_CATS.map(c=>c.label)))
  const CREDIT_CATS = ["AAA","AA","A","BBB","BB & Below"] as const
  const [creditCats, setCreditCats] = useState<Set<string>>(new Set(CREDIT_CATS))
  const [mstarCats, setMstarCats] = useState<Set<string>>(new Set(MAP_MSTAR_CATS))
  const [starMin, setStarMin] = useState(0)
  const [yieldMinP, setYieldMinP] = useState<number|null>(null)
  const [expenseMaxP, setExpenseMaxP] = useState<number|null>(null)
  const [sharpeMinP, setSharpeMinP] = useState<number|null>(null)
  const [stdDevMaxP, setStdDevMaxP] = useState<number|null>(null)

  const applyPreset = useCallback((idx: number) => { setPresetIdx(idx); const p = MAP_PRESETS[idx]; if (p) { setXIdx(findMapAxis(p.x)); setYIdx(findMapAxis(p.y)) } }, [])

  const { sortedData, avgY } = useMemo(() => {
    const mS = (f:FundData) => { if(!search)return true; const q=search.toLowerCase(); return f.ticker.toLowerCase().includes(q)||f.name.toLowerCase().includes(q) }
    const mD = (f:FundData) => { if(durationCats.size===MAP_DUR_CATS.length)return true; if(f.duration==null)return false; return MAP_DUR_CATS.some(c=>durationCats.has(c.label)&&f.duration!>=c.min&&f.duration!<c.max) }
    const mC = (f:FundData) => { if(creditCats.size===5)return true; const cs=creditScore(f); if(cs==null)return false; const r=Math.round(cs); if(creditCats.has("AAA")&&r===1)return true; if(creditCats.has("AA")&&r===2)return true; if(creditCats.has("A")&&r===3)return true; if(creditCats.has("BBB")&&r===4)return true; if(creditCats.has("BB & Below")&&r>=5)return true; return false }
    const mM = (f:FundData) => { if(mstarCats.size===MAP_MSTAR_CATS.length)return true; return f.morningstarCategory?mstarCats.has(f.morningstarCategory):false }
    const mSt = (f:FundData) => { if(starMin<=0)return true; return(f.morningstarRating??0)>=starMin }
    const mR = (f:FundData) => { if(yieldMinP!=null&&(f.ytwYtm??-Infinity)<yieldMinP)return false; if(expenseMaxP!=null&&(f.expense??Infinity)>expenseMaxP)return false; if(sharpeMinP!=null&&(f.sharpe??-Infinity)<sharpeMinP)return false; if(stdDevMaxP!=null&&(f.stdDev??Infinity)>stdDevMaxP)return false; return true }
    const pts: {x:number;y:number;ticker:string;name:string;isHighlighted:boolean;duration:number|null;ytwYtm:number|null;secYield:number|null;expense:number|null;sharpe:number|null;stdDev:number|null;ytd:number|null;oneYear:number|null;threeYear:number|null;creditQuality:string|null;morningstarRating:number|null;morningstarCategory:string|null}[] = []
    let yS=0,cnt=0
    for (const f of funds) {
      if(!mS(f)||!mD(f)||!mC(f)||!mM(f)||!mSt(f)||!mR(f)) continue
      const xV=xAxis.getValue(f), yV=yAxis.getValue(f)
      if(xV==null||yV==null) continue
      const cs=creditScore(f)
      pts.push({x:xV,y:yV,ticker:f.ticker,name:f.name,isHighlighted:false,duration:f.duration,ytwYtm:f.ytwYtm,secYield:f.secYield,expense:f.expense,sharpe:f.sharpe,stdDev:f.stdDev,ytd:f.ytd,oneYear:f.oneYear,threeYear:f.threeYear,creditQuality:cs!=null?creditLabel(cs):null,morningstarRating:f.morningstarRating,morningstarCategory:f.morningstarCategory})
      yS+=yV; cnt++
    }
    return { sortedData: pts.sort((a,b)=>a.x-b.x), avgY: cnt>0?yS/cnt:0 }
  }, [funds,xAxis,yAxis,search,durationCats,creditCats,mstarCats,starMin,yieldMinP,expenseMaxP,sharpeMinP,stdDevMaxP])

  const resetFilters = useCallback(() => { setSearch(""); setDurationCats(new Set(MAP_DUR_CATS.map(c=>c.label))); setCreditCats(new Set(["AAA","AA","A","BBB","BB & Below"])); setMstarCats(new Set(MAP_MSTAR_CATS)); setStarMin(0); setYieldMinP(null); setExpenseMaxP(null); setSharpeMinP(null); setStdDevMaxP(null) }, [])
  const hasActive = search||durationCats.size<MAP_DUR_CATS.length||creditCats.size<5||mstarCats.size<MAP_MSTAR_CATS.length||starMin>0||yieldMinP!=null||expenseMaxP!=null||sharpeMinP!=null||stdDevMaxP!=null

  return (
    <div className="rounded-xl border p-4 sm:p-5" style={{borderColor:"#e2e8f0",backgroundColor:"#fff"}}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wide" style={{color:MAP_PRI}}>FUND UNIVERSE MAP</h2>
        <span className="text-xs font-medium" style={{color:"#0f3d6b"}}>{sortedData.length} of {funds.length} funds plotted</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        {MAP_PRESETS.map((p,i) => (<button key={p.label} onClick={()=>applyPreset(i)} className="rounded-full px-3 py-1 text-xs font-semibold transition-colors" style={presetIdx===i?{backgroundColor:MAP_PRI,color:"#fff"}:{backgroundColor:"#f1f5f9",color:"#475569"}}>{p.label}</button>))}
      </div>
      {MAP_PRESETS[presetIdx]&&<p className="mb-3 text-xs italic" style={{color:"#64748b"}}>{MAP_PRESETS[presetIdx].insight}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{backgroundColor:MAP_PRI}}>X</span>
        <select value={xIdx} onChange={e=>{setXIdx(Number(e.target.value));setPresetIdx(-1)}} className="h-7 rounded-md border px-2 text-xs" style={{borderColor:"#e2e8f0"}}>{MAP_AXES.map((a,i)=><option key={a.key} value={i}>{a.label}</option>)}</select>
        <button onClick={()=>{const p=xIdx;setXIdx(yIdx);setYIdx(p);setPresetIdx(-1)}} className="flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-bold transition-all hover:border-[#0f3d6b] hover:bg-[#f0f7ff]" style={{borderColor:"#e2e8f0",color:"#64748b"}} title="Swap X and Y axes"><ArrowRightLeft className="h-3 w-3" /></button>
        <span className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{backgroundColor:MAP_PRI}}>Y</span>
        <select value={yIdx} onChange={e=>{setYIdx(Number(e.target.value));setPresetIdx(-1)}} className="h-7 rounded-md border px-2 text-xs" style={{borderColor:"#e2e8f0"}}>{MAP_AXES.map((a,i)=><option key={a.key} value={i}>{a.label}</option>)}</select>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2" style={{color:"#94a3b8"}} />
          <input value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setSearchFocused(true)} onBlur={()=>setSearchFocused(false)} placeholder="Search ticker or name..." className="h-7 w-40 rounded-md border pl-7 pr-2 text-xs outline-none transition-colors focus:border-[#0f3d6b]" style={{borderColor:searchFocused?MAP_PRI:"#e2e8f0"}} />
          {search&&<button onClick={()=>setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 hover:bg-gray-100"><X className="h-3 w-3" style={{color:"#94a3b8"}} /></button>}
        </div>
        <button onClick={()=>setShowFilters(v=>!v)} className="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors" style={{borderColor:showFilters?MAP_PRI:"#e2e8f0",color:showFilters?MAP_PRI:"#64748b",backgroundColor:showFilters?"#f0f7ff":"#fff"}}><SlidersHorizontal className="h-3 w-3" /> Filters{hasActive&&<span className="ml-0.5 h-1.5 w-1.5 rounded-full" style={{backgroundColor:"#ef4444"}} />}</button>
      </div>

      {showFilters&&(
        <div className="mb-4 rounded-lg border p-3 text-xs" style={{borderColor:"#e2e8f0",backgroundColor:"#f8fafc"}}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="mb-1.5 font-semibold" style={{color:"#334155"}}>Duration</div>
              {MAP_DUR_CATS.map(c=>(<label key={c.label} className="flex cursor-pointer items-center gap-1.5 py-0.5"><input type="checkbox" checked={durationCats.has(c.label)} onChange={()=>{const n=new Set(durationCats);n.has(c.label)?n.delete(c.label):n.add(c.label);setDurationCats(n)}} className="rounded" /><span style={{color:"#475569"}}>{c.label}</span></label>))}
            </div>
            <div>
              <div className="mb-1.5 font-semibold" style={{color:"#334155"}}>Credit Quality</div>
              {(["AAA","AA","A","BBB","BB & Below"] as const).map(c=>(<label key={c} className="flex cursor-pointer items-center gap-1.5 py-0.5"><input type="checkbox" checked={creditCats.has(c)} onChange={()=>{const n=new Set(creditCats);n.has(c)?n.delete(c):n.add(c);setCreditCats(n)}} className="rounded" /><span style={{color:"#475569"}}>{c}</span></label>))}
            </div>
            <div>
              <div className="mb-1.5 font-semibold" style={{color:"#334155"}}>Morningstar Category</div>
              <div className="max-h-36 overflow-y-auto pr-1">{MAP_MSTAR_CATS.map(c=>(<label key={c} className="flex cursor-pointer items-center gap-1.5 py-0.5"><input type="checkbox" checked={mstarCats.has(c)} onChange={()=>{const n=new Set(mstarCats);n.has(c)?n.delete(c):n.add(c);setMstarCats(n)}} className="rounded" /><span style={{color:"#475569"}}>{c}</span></label>))}</div>
            </div>
            <div>
              <div className="mb-1.5 font-semibold" style={{color:"#334155"}}>Range Filters</div>
              <div className="space-y-2">
                <div><label className="text-[10px]" style={{color:"#64748b"}}>Min YTW / YTM (%)</label><input type="number" step="0.1" value={yieldMinP??""} onChange={e=>setYieldMinP(e.target.value?Number(e.target.value):null)} className="mt-0.5 h-6 w-full rounded border px-1.5 text-xs" style={{borderColor:"#e2e8f0"}} /></div>
                <div><label className="text-[10px]" style={{color:"#64748b"}}>Max Expense (%)</label><input type="number" step="0.1" value={expenseMaxP??""} onChange={e=>setExpenseMaxP(e.target.value?Number(e.target.value):null)} className="mt-0.5 h-6 w-full rounded border px-1.5 text-xs" style={{borderColor:"#e2e8f0"}} /></div>
                <div><label className="text-[10px]" style={{color:"#64748b"}}>Min Sharpe</label><input type="number" step="0.1" value={sharpeMinP??""} onChange={e=>setSharpeMinP(e.target.value?Number(e.target.value):null)} className="mt-0.5 h-6 w-full rounded border px-1.5 text-xs" style={{borderColor:"#e2e8f0"}} /></div>
                <div><label className="text-[10px]" style={{color:"#64748b"}}>Max Std Dev</label><input type="number" step="0.1" value={stdDevMaxP??""} onChange={e=>setStdDevMaxP(e.target.value?Number(e.target.value):null)} className="mt-0.5 h-6 w-full rounded border px-1.5 text-xs" style={{borderColor:"#e2e8f0"}} /></div>
              </div>
              <div className="mt-2">
                <div className="text-[10px] font-medium" style={{color:"#64748b"}}>Min Star Rating</div>
                <div className="mt-1 flex gap-1">{[0,1,2,3,4,5].map(v=>(<button key={v} onClick={()=>setStarMin(v)} className="rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors" style={starMin===v?{backgroundColor:MAP_PRI,color:"#fff"}:{backgroundColor:"#f1f5f9",color:"#64748b"}}>{v===0?"Any":"\u2605".repeat(v)}</button>))}</div>
              </div>
            </div>
          </div>
          {hasActive&&<button onClick={resetFilters} className="mt-3 flex items-center gap-1 text-xs font-medium" style={{color:"#ef4444"}}><X className="h-3 w-3" /> Reset all filters</button>}
        </div>
      )}

      {sortedData.length<1?(
        <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed" style={{borderColor:"#e2e8f0"}}><p className="text-sm" style={{color:"#94a3b8"}}>No funds match current filters.</p></div>
      ):(
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{top:10,right:20,bottom:30,left:20}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <RXAxis type="number" dataKey="x" name={xAxis.label} domain={xAxis.isCredit?[0.5,8.5]:[(dMin:number)=>Math.max(0,Math.floor(dMin*0.9*10)/10),(dMax:number)=>Math.ceil(dMax*1.1*10)/10]} ticks={xAxis.isCredit?[1,2,3,4,5,6,7,8]:undefined} tick={{fontSize:11,fill:"#94a3b8"}} tickFormatter={v=>xAxis.tickFmt(v)} tickLine={{stroke:"#e2e8f0"}} axisLine={{stroke:"#e2e8f0"}}><Label value={xAxis.label} position="bottom" offset={12} style={{fontSize:11,fill:"#64748b",fontWeight:600}} /></RXAxis>
            <RYAxis type="number" dataKey="y" name={yAxis.label} domain={yAxis.isCredit?[0.5,8.5]:undefined} ticks={yAxis.isCredit?[1,2,3,4,5,6,7,8]:undefined} tick={{fontSize:11,fill:"#94a3b8"}} tickFormatter={v=>yAxis.tickFmt(v)} tickLine={{stroke:"#e2e8f0"}} axisLine={{stroke:"#e2e8f0"}} width={yAxis.isCredit?45:undefined}><Label value={yAxis.label} angle={-90} position="insideLeft" offset={-5} style={{fontSize:11,fill:"#64748b",fontWeight:600}} /></RYAxis>
            <ZAxis range={[50,50]} />
            <RTooltip content={<MapTip />} cursor={false} />
            {sortedData.length>=2&&<ReferenceLine y={avgY} stroke="#94a3b8" strokeDasharray="6 4" strokeWidth={1} />}
            <Scatter data={sortedData} shape={<MapDot hoveredTicker={hoveredTicker} onHover={setHoveredTicker} onLeave={()=>setHoveredTicker(null)} onClick={onSelectFund} />}>
              {sortedData.map(d=>(<Cell key={d.ticker} fill={d.isHighlighted?MAP_HL:MAP_DOT} />))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between text-[10px]" style={{color:"#94a3b8"}}>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{backgroundColor:MAP_DOT}} /> Funds in universe</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-[1px] w-5" style={{backgroundColor:"#94a3b8",borderTop:"2px dashed #94a3b8"}} /> Average</span>
        </div>
        <span className="italic">Click any fund to view details</span>
      </div>
    </div>
  )
}

export default function Page() {
  const [funds, setFunds] = useState<FundData[]>([])
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tickerA, setTickerA] = useState("")
  const [tickerB, setTickerB] = useState("")
  const [competitors, setCompetitors] = useState<string[]>([])
  // competitor add state removed -- now using TickerInput for competitor selection
  const [mode, setMode] = useState<AnalysisMode>("internal")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [warRoom, setWarRoom] = useState<WarRoom | null>(null)
  const [polishing, setPolishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [refreshingRatings, setRefreshingRatings] = useState(false)
  const [section, setSection] = useState<"comparison" | "lookup" | "map">("lookup")
  const [lookupTicker, setLookupTicker] = useState("")
  const [cameFromMap, setCameFromMap] = useState(false)

  useEffect(() => {
    fetch("/api/funds")
      .then(r => r.json())
      .then(json => {
        if (json.funds && json.funds.length > 0) {
          setFunds(json.funds)
          setLastUpdated(new Date().toISOString())
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const tickers = useMemo(() => funds.map((f) => ({ ticker: f.ticker, name: f.name })), [funds])

  const refreshRatings = useCallback(async () => {
    setRefreshingRatings(true)
    try {
      const res = await fetch("/api/refresh-ratings", { method: "POST" })
      if (res.ok) {
        // Reload funds with updated ratings
        const r = await fetch("/api/funds")
        const json = await r.json()
        if (json.funds?.length) setFunds(json.funds)
      }
    } catch { /* ignore */ }
    setRefreshingRatings(false)
  }, [])

  const handleFileLoaded = useCallback(async (buffer: ArrayBuffer, fileName: string) => {
    try {
      const parsed = parseFile(buffer, fileName)
      if (parsed.length === 0) { setError("No fund data found."); return }
      setFunds(parsed); setTickerA(""); setTickerB(""); setResult(null); setError(null); setShowUpload(false)
      setLastUpdated(new Date().toISOString())
      await saveFunds(parsed)
      await fetch("/api/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funds: parsed }),
      }).catch(() => {})
    } catch (err) {
      setError("Parse error: " + (err instanceof Error ? err.message : "Unknown"))
    }
  }, [])

  useEffect(() => {
    if (tickerA && tickerB && tickerA !== tickerB) {
      const fA = funds.find((f) => f.ticker === tickerA)
      const fB = funds.find((f) => f.ticker === tickerB)
      if (fA && fB) {
        // Always ensure tickerB is in the competitors list
        setCompetitors(prev => prev.includes(tickerB) ? prev : [...prev.slice(0, 4), tickerB])
        setError(null)
        setResult(runAnalysis(fA, fB, mode))
        if (mode === "internal") {
          setPolishing(true)
          setWarRoom(buildWarRoom(fA, fB))

          const yahooPromise = fetch(`/api/growth/analytics?tickerA=${tickerA}&tickerB=${tickerB}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)

          yahooPromise.then((yahoo: YahooAnalytics | null) => {
            return fetch("/api/warroom/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fundA: fA, fundB: fB, yahoo }),
            })
              .then(r => r.ok ? r.json() : null)
              .then(gptWarRoom => {
                if (
                  gptWarRoom &&
                  !gptWarRoom.error &&
                  Array.isArray(gptWarRoom.competitorArguments) &&
                  Array.isArray(gptWarRoom.rebuttals) &&
                  gptWarRoom.overallDifficulty &&
                  gptWarRoom.competitorArguments.every((a: Record<string, unknown>) => a.id && a.metric && a.argument)
                ) {
                  setWarRoom(gptWarRoom)
                }
              })
              .catch(() => {})
              .finally(() => setPolishing(false))
          })
        } else {
          setWarRoom(null)
          setPolishing(false)
        }
      }
    } else { setResult(null); setWarRoom(null) }
  }, [tickerA, tickerB, mode, funds])

  const swapTickers = useCallback(() => {
    const prevA = tickerA
    const prevB = tickerB
    setTickerA(prevB)
    setTickerB(prevA)
    // Ensure the swapped tickers are in the competitor list
    if (prevA && !competitors.includes(prevA)) {
      setCompetitors(prev => [...prev.slice(0, 4), prevA])
    }
  }, [tickerA, tickerB, competitors])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#f8fafc" }}>
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#94a3b8" }} />
      </main>
    )
  }

  if (funds.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4" style={{ backgroundColor: "#f8fafc" }}>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center">
            <img src="/images/angel-oak-logo.svg" alt="Angel Oak Capital Advisors" className="mb-4 h-auto w-[140px] sm:w-[180px] brightness-0 opacity-20" />
            <p className="text-sm" style={{ color: "#64748b" }}>Upload your fund data to get started</p>
          </div>
          <FileUpload onFileLoaded={handleFileLoaded} />
          {error && <p className="mt-3 text-center text-sm" style={{ color: "#dc2626" }}>{error}</p>}
        </div>
      </main>
    )
  }

  const takeaway = result?.narrative.find(s => s.title === "Takeaway")

  const incomeItems = result ? [
    { label: "SEC Yield", a: result.keyStats.find(r => r.label === "30-Day SEC Yield")?.nA ?? 0, b: result.keyStats.find(r => r.label === "30-Day SEC Yield")?.nB ?? 0 },
    { label: "Distribution", a: result.keyStats.find(r => r.label === "Distribution Yield")?.nA ?? 0, b: result.keyStats.find(r => r.label === "Distribution Yield")?.nB ?? 0 },
    { label: "YTW/YTM", a: result.keyStats.find(r => r.label === "YTW / YTM")?.nA ?? 0, b: result.keyStats.find(r => r.label === "YTW / YTM")?.nB ?? 0 },
  ].filter(x => (x.a ?? 0) > 0 || (x.b ?? 0) > 0) : []

  const riskItems = result ? [
    { label: "Duration", a: result.keyStats.find(r => r.label === "Duration")?.nA ?? 0, b: result.keyStats.find(r => r.label === "Duration")?.nB ?? 0, unit: " yrs", better: "none" as const },
    { label: "Std Deviation", a: result.keyStats.find(r => r.label === "Std Deviation")?.nA ?? 0, b: result.keyStats.find(r => r.label === "Std Deviation")?.nB ?? 0, unit: "", better: "low" as const },
    { label: "Sharpe Ratio", a: result.keyStats.find(r => r.label === "Sharpe Ratio")?.nA ?? 0, b: result.keyStats.find(r => r.label === "Sharpe Ratio")?.nB ?? 0, unit: "", better: "high" as const },
    { label: "Expense Ratio", a: (result.keyStats.find(r => r.label === "Expense Ratio")?.nA ?? 0) * 100, b: (result.keyStats.find(r => r.label === "Expense Ratio")?.nB ?? 0) * 100, unit: "%", better: "low" as const },
  ].filter(x => x.a > 0 || x.b > 0) : []

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#f8fafc" }}>
      <header style={{ backgroundColor: "#0f3d6b" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <img src="/images/angel-oak-logo.svg" alt="Angel Oak Capital Advisors" className="h-[28px] w-auto sm:h-[34px]" />
            <div className="hidden sm:block" style={{ width: 1, height: 24, backgroundColor: "rgba(255,255,255,0.2)" }} />
            <span className="hidden text-sm font-semibold tracking-tight sm:inline" style={{ color: "rgba(255,255,255,0.9)" }}>
              {section === "lookup" ? "Fund Lookup" : section === "comparison" ? "Fund Comparison" : "Fund Map"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshRatings}
              disabled={refreshingRatings || funds.length === 0}
              className="flex min-h-[44px] items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
              style={{ color: "rgba(255,255,255,0.7)" }}
              title="Fetch real Morningstar star ratings from Yahoo Finance for all funds"
            >
              {refreshingRatings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{refreshingRatings ? "Fetching..." : "Refresh Ratings"}</span>
            </button>
            <button onClick={() => setShowUpload(!showUpload)} className="flex min-h-[44px] items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors" style={{ color: "rgba(255,255,255,0.7)" }}>
              {showUpload ? <X className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
              {showUpload ? "Close" : "Update Data"}
            </button>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              {funds.length} funds
            </span>
          </div>
        </div>
      </header>

      {/* Section Nav */}
      <div className="border-b" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
        <div className="mx-auto flex max-w-6xl px-3 sm:px-6">
          <button
            onClick={() => { setSection("lookup"); setCameFromMap(false) }}
            className="flex min-h-[44px] items-center gap-1.5 border-b-2 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider transition-colors sm:text-[13px]"
            style={{
              borderColor: section === "lookup" ? "#0f3d6b" : "transparent",
              color: section === "lookup" ? "#0f3d6b" : "#94a3b8",
            }}
          >
            <Search className="h-3.5 w-3.5" />
            Fund Lookup
          </button>
          <button
            onClick={() => setSection("comparison")}
            className="flex min-h-[44px] items-center gap-1.5 border-b-2 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider transition-colors sm:text-[13px]"
            style={{
              borderColor: section === "comparison" ? "#0f3d6b" : "transparent",
              color: section === "comparison" ? "#0f3d6b" : "#94a3b8",
            }}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Fund Comparison
          </button>
          <button
                onClick={() => setSection("map")}
            className="flex min-h-[44px] items-center gap-1.5 border-b-2 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-wider transition-colors sm:text-[13px]"
            style={{
              borderColor: section === "map" ? "#0f3d6b" : "transparent",
              color: section === "map" ? "#0f3d6b" : "#94a3b8",
            }}
          >
            <Crosshair className="h-3.5 w-3.5" />
            Fund Map
          </button>
        </div>
      </div>

      {showUpload && (
        <div className="border-b px-3 py-5 sm:px-6" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
          <div className="mx-auto max-w-sm">
            <FileUpload onFileLoaded={handleFileLoaded} compact />
          </div>
        </div>
      )}

      {/* ===== FUND COMPARISON SECTION ===== */}
      {section === "comparison" && (
      <div className="mx-auto max-w-6xl px-3 sm:px-6">
        <div className="border-b py-4 sm:py-5" style={{ borderColor: "#e2e8f0" }}>
          {/* Compact grid: Our Fund | vs | Competitors | Mode */}
          <div className="flex flex-col gap-3 sm:grid sm:gap-4" style={{ gridTemplateColumns: "minmax(160px, 1fr) auto minmax(240px, 2fr) auto" }}>
            {/* Our Fund -- compact */}
            <div>
              <TickerInput label="Our Fund" value={tickerA} onChange={(v) => { setTickerA(v); if (v && competitors.length > 0 && !tickerB) setTickerB(competitors[0]) }} options={tickers} placeholder="Select fund..." />
            </div>

            {/* Swap / VS button */}
            <div className="flex items-end pb-2">
              <button
                onClick={swapTickers}
                disabled={!tickerA || !tickerB}
                className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold transition-all hover:border-[#0f3d6b] hover:bg-[#f0f7ff] disabled:cursor-not-allowed disabled:opacity-30"
                style={{ borderColor: "#e2e8f0", color: "#64748b" }}
                title="Swap our fund and competitor"
              >
                <ArrowRightLeft className="h-3 w-3" />
                <span className="hidden sm:inline">Swap</span>
              </button>
            </div>

            {/* Competitors section */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
                  Competitors {competitors.length > 0 ? `(${competitors.length}/5)` : ""}
                </span>
                {competitors.length > 1 && (
                  <button onClick={() => { setCompetitors([]); setTickerB("") }} className="text-[10px] font-medium" style={{ color: "#94a3b8" }}>Clear all</button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {/* Competitor tabs */}
                {competitors.map((comp) => {
                  const isActive = tickerB === comp
                  return (
                    <div key={comp} className="group relative">
                      <button
                        onClick={() => setTickerB(comp)}
                        className="flex h-10 items-center gap-1 rounded-lg border px-3 text-[12px] font-bold transition-all"
                        style={{
                          borderColor: isActive ? "#0f3d6b" : "#e2e8f0",
                          backgroundColor: isActive ? "#0f3d6b" : "#fff",
                          color: isActive ? "#fff" : "#334155",
                          boxShadow: isActive ? "0 1px 3px rgba(15,61,107,0.2)" : "none",
                        }}
                      >
                        {comp}
                        <span
                          role="button"
                          onClick={(e) => { e.stopPropagation(); const next = competitors.filter(c => c !== comp); setCompetitors(next); if (tickerB === comp) setTickerB(next[0] || "") }}
                          className="ml-0.5 rounded-full p-0.5 transition-colors"
                          style={{ color: isActive ? "rgba(255,255,255,0.5)" : "#94a3b8" }}
                        >
                          <X className="h-2.5 w-2.5" />
                        </span>
                      </button>
                    </div>
                  )
                })}
                {/* Add competitor button/input */}
                {competitors.length < 5 && (
                  <div className="min-w-[160px] flex-1">
                    <TickerInput
                      label=""
                      value=""
                      onChange={(v) => {
                        if (v && !competitors.includes(v)) {
                          setCompetitors(prev => [...prev.slice(0, 4), v])
                          setTickerB(v)
                        }
                      }}
                      options={tickers.filter(t => t.ticker !== tickerA && !competitors.includes(t.ticker))}
                      placeholder={competitors.length === 0 ? "Search to add competitor..." : "+ Add"}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Mode toggle */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>Mode</span>
              <div className="flex h-10 overflow-hidden rounded-lg border text-[12px] font-semibold" style={{ borderColor: "#e2e8f0" }}>
                <button onClick={() => setMode("internal")} className="px-3.5 transition-colors" style={{ backgroundColor: mode === "internal" ? "#0f3d6b" : "#fff", color: mode === "internal" ? "#fff" : "#64748b" }}>Internal</button>
                <button onClick={() => setMode("advisor")} className="px-3.5 transition-colors" style={{ backgroundColor: mode === "advisor" ? "#0f3d6b" : "#fff", color: mode === "advisor" ? "#fff" : "#64748b" }}>Advisor</button>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="pt-3 text-sm" style={{ color: "#dc2626" }}>{error}</p>}

        {!result && (
          <div className="flex flex-col items-center justify-center py-20 text-center sm:py-28">
            <ArrowRightLeft className="h-8 w-8" style={{ color: "#e2e8f0" }} />
            <p className="mt-4 text-sm" style={{ color: "#94a3b8" }}>Select a fund and add competitors above to compare</p>
          </div>
        )}

        {result && mode === "internal" && (
          <div className="space-y-4 py-4 sm:space-y-6 sm:py-6">
            <ComparisonTable title="Key Statistics" rows={result.keyStats} tickerA={result.tickerA} tickerB={result.tickerB} highlight />

            <PieWithTable title="Sector Allocation" dataA={result.pieDataA} dataB={result.pieDataB}
              tickerA={result.tickerA} tickerB={result.tickerB}
              rows={result.sectorAllocation} rowLabel="Sector" viewMode="internal" />

            <PieWithTable title="Credit Quality" dataA={result.creditPieA} dataB={result.creditPieB}
              tickerA={result.tickerA} tickerB={result.tickerB}
              subtitleA={"Avg Credit Quality: " + result.avgCreditA} subtitleB={"Avg Credit Quality: " + result.avgCreditB}
              rows={result.creditQuality} rowLabel="Rating" viewMode="internal" />

            <PerformanceChart tickerA={result.tickerA} tickerB={result.tickerB} />
            <GrowthChart tickerA={result.tickerA} tickerB={result.tickerB} mode="internal" />

            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
              <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                <div className="border-b px-3 py-2.5 sm:px-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Income</h4>
                </div>
                <div className="p-3 sm:p-4">
                  <IncomeBars items={incomeItems} tickerA={result.tickerA} tickerB={result.tickerB} />
                </div>
              </div>
              <div className="overflow-hidden rounded border" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                <div className="border-b px-3 py-2.5 sm:px-4" style={{ borderColor: "#e2e8f0", backgroundColor: "#f1f5f9" }}>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>{"Risk & Structure"}</h4>
                </div>
                <div className="p-3 sm:p-4">
                  <RiskTable items={riskItems} tickerA={result.tickerA} tickerB={result.tickerB} />
                </div>
              </div>
            </div>

            {takeaway && (
              <div className="rounded border-l-4 p-4 sm:p-5" style={{ borderColor: "#0f3d6b", backgroundColor: "#f0f7ff" }}>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Key Takeaway</h3>
                <ul className="space-y-2">
                  {takeaway.lines.map((line, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: "#1e293b" }}>
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "#0f3d6b" }} />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {warRoom && <CompetitorWarRoom warRoom={warRoom} competitorTicker={result.tickerB} ourTicker={result.tickerA} polishing={polishing} />}

            <ElevatorPitch result={result} />

            <FundChat result={result} />

          </div>
        )}

        {result && mode === "advisor" && (
          <div className="space-y-6 py-6 sm:space-y-8 sm:py-8">
            <div className="text-center">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-widest sm:mb-5" style={{ color: "#94a3b8" }}>Fund Comparison</div>
              <div className="flex items-center justify-center gap-4 sm:gap-10">
                <div className="flex flex-col items-center">
                  <p className="text-lg font-bold tracking-wide sm:text-xl" style={{ color: "#0f3d6b" }}>{result.tickerA}</p>
                  <p className="mt-0.5 max-w-[140px] text-center text-[10px] leading-tight sm:max-w-[180px] sm:text-[11px]" style={{ color: "#94a3b8" }}>{result.nameA}</p>
                </div>
                <span className="text-xl font-light italic sm:text-2xl" style={{ color: "#cbd5e1" }}>vs.</span>
                <div className="flex flex-col items-center">
                  <p className="text-lg font-bold tracking-wide sm:text-xl" style={{ color: "#0f3d6b" }}>{result.tickerB}</p>
                  <p className="mt-0.5 max-w-[140px] text-center text-[10px] leading-tight sm:max-w-[180px] sm:text-[11px]" style={{ color: "#94a3b8" }}>{result.nameB}</p>
                </div>
              </div>
            </div>

            <div style={{ height: 2, backgroundColor: "#0f3d6b", opacity: 0.15 }} />

            <ComparisonTable title="Key Statistics" rows={result.keyStats} tickerA={result.tickerA} tickerB={result.tickerB} />

            <PieWithTable title="Sector Allocation" dataA={result.pieDataA} dataB={result.pieDataB}
              tickerA={result.tickerA} tickerB={result.tickerB}
              rows={result.sectorAllocation} rowLabel="Sector" viewMode="advisor" />

            <PieWithTable title="Credit Quality" dataA={result.creditPieA} dataB={result.creditPieB}
              tickerA={result.tickerA} tickerB={result.tickerB}
              subtitleA={"Avg Credit Quality: " + result.avgCreditA} subtitleB={"Avg Credit Quality: " + result.avgCreditB}
              rows={result.creditQuality} rowLabel="Rating" viewMode="advisor" />

            <ComparisonTable title="Performance" rows={result.performance} tickerA={result.tickerA} tickerB={result.tickerB} />

            <GrowthChart tickerA={result.tickerA} tickerB={result.tickerB} mode="advisor" />

            {takeaway && (
              <div className="rounded border p-4 sm:p-6" style={{ borderColor: "#e2e8f0", backgroundColor: "#fff" }}>
                <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#0f3d6b" }}>Investment Considerations</h3>
                <ul className="space-y-2">
                  {takeaway.lines.map((line, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: "#475569" }}>
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "#94a3b8" }} />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 text-center" style={{ borderTop: "1px solid #e2e8f0" }}>
              <img src="/images/angel-oak-logo.svg" alt="Angel Oak Capital Advisors" className="mx-auto opacity-20 brightness-0" style={{ width: 120, height: "auto" }} />
              <p className="mt-2 text-[10px]" style={{ color: "#94a3b8" }}>For informational purposes only. Past performance is not indicative of future results.</p>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ===== FUND MAP SECTION (inlined) ===== */}
      {section === "map" && (
        <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-6">
          <InlineFundMap funds={funds} onSelectFund={(t) => { setLookupTicker(t); setCameFromMap(true); setSection("lookup") }} />
        </div>
      )}

      {/* ===== FUND LOOKUP SECTION ===== */}
      {section === "lookup" && (
      <div className="mx-auto max-w-6xl px-3 sm:px-6">
        <div className="border-b py-4 sm:py-5" style={{ borderColor: "#e2e8f0" }}>
          <div className="flex items-end gap-4">
            <div className="max-w-sm flex-1">
              <TickerInput label="Look Up Fund" value={lookupTicker} onChange={(v) => { setLookupTicker(v); if (!v) setCameFromMap(false) }} options={tickers} />
            </div>
            {cameFromMap && (
              <button
            onClick={() => setSection("map")}
                className="mb-0.5 flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold transition-all hover:bg-[#f0f7ff]"
                style={{ borderColor: "#e2e8f0", color: "#0f3d6b" }}
              >
                <Crosshair className="h-3.5 w-3.5" />
                Back to Map
              </button>
            )}
          </div>
        </div>

        {!lookupTicker && (
          <div className="flex flex-col items-center justify-center py-20 text-center sm:py-28">
            <Search className="h-8 w-8" style={{ color: "#e2e8f0" }} />
            <p className="mt-4 text-sm" style={{ color: "#94a3b8" }}>Search for a fund to view its profile</p>
          </div>
        )}

        {lookupTicker && (() => {
          const fund = funds.find(f => f.ticker === lookupTicker)
          if (!fund) return null
          const ANGEL_OAK_TICKERS = new Set(["ANGIX", "CARY", "UYLD", "AOUIX", "ASCIX", "TRBF", "AOHY", "MBS", "FINS"])
          return <FundLookup fund={fund} allTickers={tickers} onCompare={(ticker) => {
            if (ANGEL_OAK_TICKERS.has(ticker)) {
              // Angel Oak fund goes into "Our Fund" slot
              setTickerA(ticker)
              setTickerB("")
            } else {
              // Non-Angel Oak fund goes into competitors
              setTickerB(ticker)
              if (!competitors.includes(ticker)) setCompetitors(prev => [...prev.slice(0, 4), ticker])
              setTickerA("")
            }
            setSection("comparison")
          }} />
        })()}
      </div>
      )}
    </main>
  )
}
