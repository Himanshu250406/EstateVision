import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowUpRight, BadgeCheck, Building2, BarChart3,
  ChevronDown, CircleDollarSign, Compass, Home, LayoutDashboard, LoaderCircle,
  MapPin, Menu, Plus, RefreshCw, Ruler, Search, ShieldCheck, Sparkles, Waves,
  X, Zap
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  BarChart, Bar, ScatterChart, Scatter, ReferenceLine, ZAxis
} from 'recharts'

const API = import.meta.env.VITE_API_URL || 'http://192.168.1.11:5000'
const fallbackCategories = {
  Location: ['Gurugram', 'Indore', 'Jaipur', 'Kanpur', 'Lucknow', 'Noida', 'Prayagraj'],
  Street_Type: ['Corner Plot', 'Gated Society', 'Highway Facing', 'Main Road', 'Residential Lane'],
  Furnishing: ['Furnished', 'Semi-Furnished', 'Unfurnished'],
  Property_Type: ['Apartment', 'Duplex', 'Independent House', 'Villa'],
}
const initialForm = {
  Area_SqFt: '2000', Rooms: '4', Build_Year: '2015', Has_Pool: 'No',
  Location: 'Indore', Street_Type: 'Main Road',
  Furnishing: 'Semi-Furnished', Property_Type: 'Apartment',
}
const money = value => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0
}).format(value || 0)

function MetricCard({ label, value, note, icon: Icon, trend }) {
  return <div className="panel rounded-2xl p-5">
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#96979a]">{label}</span>
      <span className="rounded-xl bg-white/[.05] p-2 text-[#c7a875]"><Icon size={17}/></span>
    </div>
    <div className="mt-4 font-display text-2xl font-bold tracking-tight">{value}</div>
    <div className="mt-2 flex items-center gap-1 text-xs text-[#85878c]">
      {trend && <ArrowUpRight size={13} className="text-[#a9bd9b]"/>}{note}
    </div>
  </div>
}

function Field({ label, value, onChange, options, type = 'text', placeholder }) {
  return <label className="block">
    <span className="mb-2 block text-xs font-medium text-[#a5a5a7]">{label}</span>
    {options ? <select className="field" value={value} onChange={e => onChange(e.target.value)}>
      {options.map(item => <option key={item} value={item}>{item}</option>)}
    </select> : <input className="field" type={type} value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} />}
  </label>
}

export default function App() {
  const [active, setActive] = useState('Overview')
  const [form, setForm] = useState(initialForm)
  const [dashboard, setDashboard] = useState(null)
  const [apiStatus, setApiStatus] = useState('checking')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [diagnostics, setDiagnostics] = useState(null)
  const [diagnosticsError, setDiagnosticsError] = useState('')
  const [mobileNav, setMobileNav] = useState(false)

  
const loadDashboard = async () => {
  try {
    const [health, stats] = await Promise.all([
      fetch(`${API}/api/health`),
      fetch(`${API}/api/dashboard`)
    ])

    if (!health.ok || !stats.ok) {
      throw new Error('Backend unavailable')
    }

    const healthData = await health.json()
    const statsData = await stats.json()

    setDashboard(statsData)
    setApiStatus(
      healthData.model_loaded ? 'online' : 'untrained'
    )

    // Fetch model diagnostics separately
    try {
      const response = await fetch(`${API}/api/diagnostics`)

      if (!response.ok) {
        throw new Error('Could not load diagnostics')
      }

      const data = await response.json()

      setDiagnostics(data)
      setDiagnosticsError('')
    } catch (err) {
      setDiagnostics(null)
      setDiagnosticsError(err.message)
    }

  } catch (err) {
    setApiStatus('offline')
  }
}

  useEffect(() => { loadDashboard() }, [])


  const categories = { ...fallbackCategories, ...(dashboard?.categories || {}) }
  const update = (key, value) => setForm(old => ({ ...old, [key]: value }))

  
const diagnosticRows = useMemo(() => {
  return (diagnostics?.predictions || [])
    .map((item, index) => {
      const actual = Number(item.actual)
      const predicted = Number(item.predicted)
      const residual = Number(item.residual)

      return {
        id: index + 1,
        actual,
        predicted,
        residual,
        absError: Math.abs(residual)
      }
    })
    .filter(item =>
      Number.isFinite(item.actual) &&
      Number.isFinite(item.predicted) &&
      Number.isFinite(item.residual)
    )
}, [diagnostics])

  const scatterValues = diagnosticRows.flatMap(row => [
  row.actual,
  row.predicted
])

const scatterMin = scatterValues.length
  ? Math.min(...scatterValues)
  : 0

const scatterMax = scatterValues.length
  ? Math.max(...scatterValues)
  : 1

const residualHistogram = useMemo(() => {
  if (!diagnosticRows.length) return []

  const values = diagnosticRows.map(item => item.residual)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const binCount = 12
  const width = (max - min) / binCount || 1

  const bins = Array.from({ length: binCount }, (_, i) => ({
    range: `${Math.round(min + i * width).toLocaleString('en-IN')} to ${Math.round(min + (i + 1) * width).toLocaleString('en-IN')}`,
    midpoint: min + (i + 0.5) * width,
    count: 0
  }))

  values.forEach(value => {
    const index = Math.min(
      Math.floor((value - min) / width),
      binCount - 1
    )
    bins[index].count++
  })

  return bins
}, [diagnosticRows])

const diagnosticSummary = useMemo(() => {
  if (!diagnosticRows.length) return null

  const total = diagnosticRows.length
  const meanResidual = diagnosticRows.reduce(
    (sum, item) => sum + item.residual, 0
  ) / total

  return {
    total,
    meanResidual,
    mae: diagnosticRows.reduce(
      (sum, item) => sum + item.absError, 0
    ) / total,
    maxError: Math.max(...diagnosticRows.map(item => item.absError)),
    underestimates: diagnosticRows.filter(item => item.residual > 0).length,
    overestimates: diagnosticRows.filter(item => item.residual < 0).length
  }
}, [diagnosticRows])

const largestErrors = useMemo(() => {
  return [...diagnosticRows]
    .sort((a, b) => b.absError - a.absError)
    .slice(0, 8)
}, [diagnosticRows])


  const predict = async e => {
    e.preventDefault()
    setBusy(true); setError(''); setResult(null)
    try {
      const response = await fetch(`${API}/api/predict`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, Area_SqFt: Number(form.Area_SqFt),
          Rooms: Number(form.Rooms), Build_Year: Number(form.Build_Year) })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not calculate valuation.')
      setResult(data)
      setHistory(old => [{ ...form, price: data.predicted_price, date: new Date() }, ...old].slice(0, 8))
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  const metrics = dashboard?.metrics || []
  const best = metrics[0]
  const chartData = useMemo(() => metrics.map(m => ({
    name: m.model.replace(' Regression', '').replace(' ', '\n'), r2: +(m.r2 * 100).toFixed(1),
    rmse: Math.round(m.rmse)
  })), [metrics])
  const navItems = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Property Valuation', icon: Home },
    { label: 'Analytics', icon: BarChart3 },
  ]

  return <div className="min-h-screen bg-[#090b0f] text-[#f3f0e9]">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-white/[.07] bg-[#0d0f13] px-5 py-6 transition-transform lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center gap-3 px-2">
        <div className="gold-bg flex h-10 w-10 items-center justify-center rounded-xl"><Building2 size={21}/></div>
        <div><div className="font-display text-lg font-extrabold tracking-tight">estate<span className="gold">vision</span></div><div className="eyebrow !text-[8px]">Property intelligence</div></div>
        <button className="ml-auto text-white/60 lg:hidden" onClick={() => setMobileNav(false)}><X size={19}/></button>
      </div>
      <div className="mt-12 px-3 eyebrow">Workspace</div>
      <nav className="mt-3 space-y-1">
        {navItems.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActive(label); setMobileNav(false) }}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${active === label ? 'bg-[#c7a875]/10 text-[#d5b77e]' : 'text-[#92949a] hover:bg-white/[.04] hover:text-white'}`}>
          <Icon size={17}/>{label}{label === 'Property Valuation' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#c7a875]"/>}
        </button>)}
      </nav>
      <div className="mt-auto rounded-2xl border border-[#c7a875]/20 bg-[#c7a875]/[.06] p-4">
        <div className="flex items-center gap-2 text-[#d5b77e]"><Sparkles size={15}/><span className="text-xs font-semibold">Valuation engine</span></div>
        <p className="mt-2 text-xs leading-5 text-[#9d9da0]">A data-led view of residential property value, powered by your trained ML model.</p>
        <div className="mt-4 flex items-center gap-2 text-[10px] text-[#a7a7a7]"><span className={`h-1.5 w-1.5 rounded-full ${apiStatus === 'online' ? 'bg-emerald-400' : 'bg-amber-400'}`}/>{apiStatus === 'online' ? 'ENGINE CONNECTED' : apiStatus === 'untrained' ? 'MODEL NOT TRAINED' : 'ENGINE OFFLINE'}</div>
      </div>
      <div className="mt-5 border-t border-white/[.07] pt-4 text-[10px] text-[#65676d]">ESTATEVISION • PROJECT EDITION 1.0</div>
    </aside>

    {mobileNav && <button aria-label="Close menu" onClick={() => setMobileNav(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden"/>}

    <main className="min-h-screen lg:ml-[248px]">
      <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-white/[.07] bg-[#090b0f]/90 px-5 backdrop-blur-xl md:px-9">
        <div className="flex items-center gap-3">
          <button className="text-white/70 lg:hidden" onClick={() => setMobileNav(true)}><Menu/></button>
          <div><div className="text-xs text-[#777980]">Workspace / <span className="text-[#c7a875]">{active}</span></div><div className="mt-1 font-display text-sm font-bold">{active === 'Overview' ? 'Market overview' : active === 'Analytics' ? 'Model analytics' : 'Property valuation'}</div></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-white/[.08] px-3 py-2 text-[11px] text-[#a4a5a8] sm:flex"><span className={`h-1.5 w-1.5 rounded-full ${apiStatus === 'online' ? 'bg-emerald-400' : 'bg-amber-400'}`}/>{apiStatus === 'online' ? 'System operational' : 'System not ready'}</div>
          <button onClick={loadDashboard} className="rounded-xl border border-white/[.08] p-2.5 text-[#9b9da2] hover:text-white" title="Refresh data"><RefreshCw size={16}/></button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#c7a875]/40 bg-[#c7a875]/10 text-xs font-bold text-[#d5b77e]">EV</div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-8 md:px-9 md:py-10">
        {active === 'Overview' && <>
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div><div className="eyebrow">WEDNESDAY, NOVEMBER 04, 2026</div><h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight md:text-[38px]">See the value <span className="gold">beneath the surface.</span></h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#92949a]">A clearer perspective on residential property valuation, powered by machine learning.</p></div>
            <button onClick={() => setActive('Property Valuation')} className="gold-bg flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition hover:bg-[#dfc18a]"><Plus size={17}/> New valuation</button>
          </div>

          <div className="relative mb-7 overflow-hidden rounded-3xl border border-[#c7a875]/20 bg-[#171a1f]">
            <div className="absolute inset-0 bg-gradient-to-r from-[#111318] via-[#111318]/95 to-[#111318]/30"/>
            <div className="absolute inset-0 opacity-35" style={{backgroundImage:"url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=85')",backgroundSize:'cover',backgroundPosition:'center'}}/>
            <div className="relative max-w-2xl px-7 py-9 md:px-10 md:py-12">
              <div className="eyebrow flex items-center gap-2"><Sparkles size={12}/> Intelligent property insights</div>
              <h2 className="mt-4 font-display text-2xl font-bold leading-tight md:text-4xl">Every property has a story.<br/><span className="gold">Let's read its numbers.</span></h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#b3b3b4]">Explore an estimated market value through the lens of location, space, design and the details that matter.</p>
              <button onClick={() => setActive('Property Valuation')} className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#d5b77e]/50 px-4 py-3 text-xs font-semibold text-[#e0c58f] hover:bg-[#c7a875]/10">Evaluate a property <ArrowUpRight size={15}/></button>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between"><h3 className="font-display text-base font-bold">Model snapshot</h3><span className="text-[10px] text-[#73757b]">LIVE FROM YOUR TRAINED MODEL</span></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Selected model" value={dashboard?.best_model?.replace(' Regression','') || 'Awaiting model'} note="Highest R² in evaluation" icon={Zap}/>
            <MetricCard label="Training records" value={dashboard?.rows_used?.toLocaleString('en-IN') || '—'} note="Rows used after cleaning" icon={Building2}/>
            <MetricCard label="Input features" value={dashboard?.feature_count || '—'} note="Encoded model dimensions" icon={Activity}/>
            <MetricCard label="Best model R²" value={best ? `${(best.r2*100).toFixed(1)}%` : '—'} note="Held-out test-set score" icon={BadgeCheck}/>
          </div>

          <div className="mt-7 grid gap-5 xl:grid-cols-[1.35fr_.9fr]">
            <section className="panel rounded-2xl p-5 md:p-6">
              <div className="flex items-center justify-between"><div><h3 className="font-display font-bold">Model performance</h3><p className="mt-1 text-xs text-[#85878c]">R² score across trained algorithms</p></div><span className="rounded-lg bg-white/[.04] px-3 py-2 text-[10px] text-[#a5a6a9]">TEST SET</span></div>
              {chartData.length ? <div className="mt-5 h-[245px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:10,right:8,left:-18,bottom:0}}><CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false}/><XAxis dataKey="name" tick={{fill:'#85878c',fontSize:10}} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{fill:'#777980',fontSize:10}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#171a1f',border:'1px solid #34363b',borderRadius:12,color:'#fff'}} formatter={v=>[`${v}%`,'R² score']}/><Bar dataKey="r2" fill="#c7a875" radius={[6,6,0,0]} maxBarSize={48}/></BarChart></ResponsiveContainer></div> : <EmptyState message="Train your models to see the performance comparison here."/>}
            </section>
            <section className="panel rounded-2xl p-5 md:p-6">
              <div className="flex items-center justify-between"><div><h3 className="font-display font-bold">Feature influence</h3><p className="mt-1 text-xs text-[#85878c]">Top signals in the selected model</p></div><Compass size={17} className="gold"/></div>
              {dashboard?.feature_importance?.length ? <div className="mt-6 space-y-4">{dashboard.feature_importance.slice(0,6).map((item,i)=>{const max=dashboard.feature_importance[0].importance||1;return <div key={item.feature}><div className="mb-2 flex justify-between gap-3 text-xs"><span className="truncate text-[#c8c8c8]">{item.feature.replaceAll('_',' ')}</span><span className="text-[#999]">{(item.importance/max*100).toFixed(0)}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full bg-[#c7a875]" style={{width:`${item.importance/max*100}%`}}/></div></div>})}</div> : <EmptyState message="Feature influence will appear after model training."/>}
            </section>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[.07] bg-white/[.02] px-5 py-4"><div className="flex items-center gap-3"><ShieldCheck className="gold" size={19}/><div><div className="text-xs font-semibold">Model-led estimates, not guaranteed sale prices</div><div className="mt-1 text-[11px] text-[#777980]">Use predictions as an analytical starting point, not a formal appraisal.</div></div></div><button onClick={()=>setActive('Analytics')} className="text-xs font-semibold text-[#d5b77e]">View analytics <ArrowUpRight size={13} className="inline"/></button></div>
        </>}

        {active === 'Property Valuation' && <div className="mx-auto max-w-5xl">
          <div className="mb-8"><div className="eyebrow">VALUATION STUDIO / 01</div><h1 className="mt-3 font-display text-3xl font-extrabold">Discover a property's <span className="gold">estimated worth.</span></h1><p className="mt-2 text-sm text-[#92949a]">Enter the property details below. Your trained model will do the rest.</p></div>
          <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <form onSubmit={predict} className="panel rounded-2xl p-5 md:p-7">
              <div className="mb-6 flex items-center gap-3 border-b border-white/[.07] pb-5"><div className="rounded-xl bg-[#c7a875]/10 p-3 gold"><Home size={19}/></div><div><h2 className="font-display font-bold">Property specifications</h2><p className="mt-1 text-xs text-[#85878c]">Tell us about the home you're evaluating</p></div></div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Built-up area (sq. ft.)" value={form.Area_SqFt} onChange={v=>update('Area_SqFt',v)} type="number"/>
                <Field label="Number of rooms" value={form.Rooms} onChange={v=>update('Rooms',v)} type="number"/>
                <Field label="Year built" value={form.Build_Year} onChange={v=>update('Build_Year',v)} type="number"/>
                <Field label="Swimming pool" value={form.Has_Pool} onChange={v=>update('Has_Pool',v)} options={['No','Yes']}/>
                <Field label="City / location" value={form.Location} onChange={v=>update('Location',v)} options={categories.Location}/>
                <Field label="Street type" value={form.Street_Type} onChange={v=>update('Street_Type',v)} options={categories.Street_Type}/>
                <Field label="Furnishing" value={form.Furnishing} onChange={v=>update('Furnishing',v)} options={categories.Furnishing}/>
                <Field label="Property type" value={form.Property_Type} onChange={v=>update('Property_Type',v)} options={categories.Property_Type}/>
              </div>
              {error && <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-300">{error}</div>}
              <button disabled={busy || apiStatus !== 'online'} className="gold-bg mt-7 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-4 text-sm font-bold transition hover:bg-[#dfc18a] disabled:cursor-not-allowed disabled:opacity-50">{busy?<LoaderCircle className="animate-spin" size={17}/>:<Sparkles size={17}/>} {busy?'Calculating valuation…':'Calculate estimated value'} <ArrowUpRight size={16}/></button>
              {apiStatus !== 'online' && <p className="mt-3 text-center text-[11px] text-[#85878c]">Start the Flask backend and train the model to enable predictions.</p>}
            </form>
            <div className="space-y-5">
              <div className="panel relative min-h-[320px] overflow-hidden rounded-2xl p-6">
                <div className="absolute -right-14 -top-14 h-48 w-48 rounded-full border border-[#c7a875]/10"/><div className="absolute -right-7 -top-7 h-32 w-32 rounded-full border border-[#c7a875]/10"/>
                <div className="eyebrow">YOUR ESTIMATED VALUE</div>
                {result ? <><div className="mt-8 font-display text-3xl font-extrabold leading-tight gold md:text-4xl">{money(result.predicted_price)}</div><div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[.07] px-3 py-1.5 text-[10px] text-emerald-300"><BadgeCheck size={13}/> Prediction generated</div><div className="mt-8 border-t border-white/[.08] pt-5 text-xs text-[#888b91]">Model used <span className="float-right text-[#d4d4d4]">{result.model}</span></div><button onClick={()=>{setResult(null);setError('')}} className="mt-5 text-xs text-[#d5b77e]">Clear result</button></> : <><div className="mt-8 font-display text-4xl font-bold text-white/20">₹ —</div><p className="mt-3 max-w-[230px] text-sm leading-6 text-[#85878c]">Your valuation will appear here once the property details are submitted.</p><div className="mt-10 flex items-center gap-2 text-xs text-[#74767c]"><Sparkles size={14} className="gold"/> Powered by your selected ML model</div></>}
              </div>
              <div className="panel rounded-2xl p-5"><div className="flex items-center gap-2"><ShieldCheck size={17} className="gold"/><h3 className="text-sm font-semibold">A note on accuracy</h3></div><p className="mt-3 text-xs leading-6 text-[#92949a]">The estimate reflects patterns learned from the dataset used to train this model. Real-world prices can also depend on market timing, legal status, amenities and other factors not represented in the data.</p></div>
            </div>
          </div>
        </div>}

        {active === 'Analytics' && <div>
          <div className="mb-8"><div className="eyebrow">MODEL INTELLIGENCE / 02</div><h1 className="mt-3 font-display text-3xl font-extrabold">Behind the <span className="gold">prediction.</span></h1><p className="mt-2 text-sm text-[#92949a]">Compare model performance and inspect the signals shaping each estimate.</p></div>
          <div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Best algorithm" value={dashboard?.best_model?.replace(' Regression','')||'—'} note="Selected by test R²" icon={Zap}/><MetricCard label="Mean absolute error" value={best?money(best.mae):'—'} note="Average absolute test error" icon={CircleDollarSign}/><MetricCard label="Root mean squared error" value={best?money(best.rmse):'—'} note="Penalizes larger errors" icon={Activity}/></div>
          <div className="panel mt-6 rounded-2xl p-5 md:p-7"><h3 className="font-display font-bold">Algorithm comparison</h3><p className="mt-1 text-xs text-[#85878c]">Metrics calculated on the held-out test set</p>
            {metrics.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="text-[#777980]"><tr className="border-b border-white/[.08]"><th className="pb-3 font-medium">MODEL</th><th className="pb-3 font-medium">MAE</th><th className="pb-3 font-medium">MSE</th><th className="pb-3 font-medium">RMSE</th><th className="pb-3 font-medium">R² SCORE</th></tr></thead><tbody>{metrics.map((m,i)=><tr key={m.model} className="border-b border-white/[.05] last:border-0"><td className="py-4 font-semibold text-[#dedede]">{m.model}{i===0&&<span className="ml-2 rounded-full bg-[#c7a875]/10 px-2 py-1 text-[9px] text-[#d5b77e]">BEST</span>}</td><td className="py-4 text-[#a6a7aa]">{money(m.mae)}</td><td className="py-4 text-[#a6a7aa]">{m.mse.toLocaleString('en-IN',{maximumFractionDigits:0})}</td><td className="py-4 text-[#a6a7aa]">{money(m.rmse)}</td><td className="py-4 gold">{(m.r2*100).toFixed(2)}%</td></tr>)}</tbody></table></div>:<EmptyState message="No evaluation metrics yet. Run the training script to populate this table."/>}
          </div>
          <div className="panel mt-6 rounded-2xl p-5 md:p-7"><h3 className="font-display font-bold">Feature influence</h3><p className="mt-1 text-xs text-[#85878c]">Relative importance from the selected model (or absolute coefficients for linear regression)</p>
          
<div className="mt-6 grid gap-6 xl:grid-cols-2">

  {/* Largest Errors */}
  <div className="panel rounded-2xl p-5 md:p-7 xl:col-span-2">
    <h3 className="font-display font-bold">
      Largest prediction errors
    </h3>
    <p className="mt-1 text-xs text-[#85878c]">
      Eight test observations with the highest absolute error
    </p>

    {largestErrors.length ? (
      <div className="mt-5 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={largestErrors}
            layout="vertical"
            margin={{ left: 10, right: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#292b30" />
            <XAxis
              type="number"
              stroke="#85878c"
              tickFormatter={(value) =>
                `₹${(value / 1000).toFixed(0)}k`
              }
            />
            <YAxis
              type="category"
              dataKey="id"
              stroke="#85878c"
              width={90}
              tickFormatter={(value) => `Sample ${value}`}
            />
            <Tooltip
              contentStyle={{
                background: '#17191e',
                border: '1px solid #34363c',
                borderRadius: '10px'
              }}
              formatter={(value) => money(value)}
            />
            <Bar
              dataKey="absError"
              name="Absolute error"
              fill="#c7a875"
              radius={[0, 5, 5, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <EmptyState message="No prediction errors available." />
    )}
  </div>
    {/* Actual vs Predicted */}
  <div className="panel rounded-2xl p-5 md:p-7">
    <h3 className="font-display font-bold">
      Actual vs Predicted
    </h3>
    <p className="mt-1 text-xs text-[#85878c]">
      Comparison across the first 40 test observations
    </p>

    {diagnosticRows.length ? (
      <div className="mt-5 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          
<ScatterChart margin={{ top: 15, right: 20, bottom: 20, left: 15 }}>
  <CartesianGrid strokeDasharray="3 3" stroke="#292b30" />

  <XAxis
    type="number"
    dataKey="actual"
    name="Actual price"
    domain={[scatterMin, scatterMax]}
    stroke="#85878c"
    tickFormatter={value => `₹${(value / 1000).toFixed(0)}k`}
  />

  <YAxis
    type="number"
    dataKey="predicted"
    name="Predicted price"
    domain={[scatterMin, scatterMax]}
    stroke="#85878c"
    tickFormatter={value => `₹${(value / 1000).toFixed(0)}k`}
  />

  <ZAxis range={[45, 45]} />

  <Tooltip
    cursor={{ strokeDasharray: '3 3' }}
    contentStyle={{
      background: '#17191e',
      border: '1px solid #34363c',
      borderRadius: '10px'
    }}
    formatter={value => money(value)}
  />

  <ReferenceLine
    segment={[
      { x: scatterMin, y: scatterMin },
      { x: scatterMax, y: scatterMax }
    ]}
    stroke="#c7a875"
    strokeDasharray="6 5"
    strokeWidth={2}
  />

  <Scatter
    name="Property predictions"
    data={diagnosticRows.slice(0, 40)}
    fill="#65b8a5"
    fillOpacity={0.8}
  />
</ScatterChart>

        </ResponsiveContainer>
      </div>
    ) : (
      <EmptyState message="Prediction diagnostics are unavailable." />
    )}
  </div>

  {/* Residual Distribution */}
  <div className="panel rounded-2xl p-5 md:p-7">
    <h3 className="font-display font-bold">
      Residual distribution
    </h3>
    <p className="mt-1 text-xs text-[#85878c]">
      Frequency of prediction errors across the test set
    </p>

    {residualHistogram.length ? (
      <div className="mt-5 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={residualHistogram}>
            <CartesianGrid strokeDasharray="3 3" stroke="#292b30" />
            <XAxis
              dataKey="range"
              stroke="#85878c"
              hide
            />
            <YAxis stroke="#85878c" />
            <Tooltip
              contentStyle={{
                background: '#17191e',
                border: '1px solid #34363c',
                borderRadius: '10px'
              }}
            />
            <Bar
              dataKey="count"
              name="Observations"
              fill="#c7a875"
              radius={[5, 5, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <EmptyState message="Residual data is unavailable." />
    )}
  </div>

</div>

            {dashboard?.feature_importance?.length ? <div className="mt-6 grid gap-x-10 gap-y-5 md:grid-cols-2">{dashboard.feature_importance.map(item=><div key={item.feature}><div className="mb-2 flex justify-between text-xs"><span>{item.feature.replaceAll('_',' ')}</span><span className="text-[#a5a5a5]">{item.importance.toFixed(4)}</span></div><div className="h-2 rounded-full bg-white/[.06]"><div className="h-2 rounded-full bg-[#c7a875]" style={{width:`${item.importance/(dashboard.feature_importance[0].importance||1)*100}%`}}/></div></div>)}</div>:<EmptyState message="Train the model to inspect feature influence."/>}
          </div>
        </div>}
        <footer className="mt-12 flex flex-col justify-between gap-2 border-t border-white/[.07] py-6 text-[10px] text-[#666970] sm:flex-row"><span>© 2026 ESTATEVISION. BUILT FOR BETTER PROPERTY DECISIONS.</span><span>INTELLIGENCE, WITH PERSPECTIVE.</span></footer>
      </div>
    </main>
  </div>
}

function EmptyState({ message }) {
  return <div className="flex min-h-[170px] flex-col items-center justify-center text-center"><div className="rounded-full bg-white/[.04] p-3 text-[#777980]"><BarChart3 size={20}/></div><p className="mt-3 max-w-xs text-xs leading-5 text-[#85878c]">{message}</p></div>
}
