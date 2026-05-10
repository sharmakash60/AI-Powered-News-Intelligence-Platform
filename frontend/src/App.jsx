import { useEffect, useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { fetchArticles, fetchStats, fetchCategories, runPipeline } from './api'

/* ─── THEME ─────────────────────────────────────────────── */
const T = {
  bg:       '#07080f',
  surface:  '#0d1117',
  card:     '#111827',
  border:   '#1f2937',
  borderHi: '#374151',
  accent:   '#3b82f6',
  accentDim:'#1d4ed8',
  green:    '#10b981',
  red:      '#f43f5e',
  slate:    '#6b7280',
  text:     '#f1f5f9',
  muted:    '#9ca3af',
  dim:      '#4b5563',
}

const SENTIMENT_COLORS = {
  positive: T.green,
  negative: T.red,
  neutral:  T.slate,
}

/* ─── NORMALISE ──────────────────────────────────────────── */
// API may return "Positive", "POSITIVE", or "positive" — normalise to lowercase
const norm = (val) => (val ?? '').toString().trim().toLowerCase()

/* ─── APP ────────────────────────────────────────────────── */
export default function App() {
  const [articles,          setArticles]          = useState([])
  const [stats,             setStats]             = useState(null)
  const [categories,        setCategories]        = useState([])
  const [loading,           setLoading]           = useState(true)
  const [search,            setSearch]            = useState('')
  const [running,           setRunning]           = useState(false)
  const [selectedCategory,  setSelectedCategory]  = useState('all')
  const [selectedSentiment, setSelectedSentiment] = useState('all')
  const [currentPage,       setCurrentPage]       = useState(1)
  const [activeCard,        setActiveCard]        = useState(null)
  const ARTICLES_PER_PAGE = 24

  async function loadData() {
    try {
      setLoading(true)
      const [articleData, statsData, categoryData] = await Promise.all([
        fetchArticles(), fetchStats(), fetchCategories(),
      ])
      setArticles(articleData.articles || [])
      setStats(statsData)
      setCategories(categoryData.categories || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handlePipeline() {
    try {
      setRunning(true)
      await runPipeline()
      setTimeout(loadData, 4000)
    } catch (e) { console.error(e) }
    finally { setRunning(false) }
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => { setCurrentPage(1) }, [search, selectedCategory, selectedSentiment])

  /* ── loading ── */
  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background: T.bg, flexDirection:'column', gap:'20px' }}>
      <div style={{ width:'48px', height:'48px', border:`3px solid ${T.border}`,
        borderTop:`3px solid ${T.accent}`, borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <p style={{ color: T.muted, fontFamily:'monospace', letterSpacing:'0.1em', fontSize:'13px' }}>
        LOADING NEWSINTEL
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  /* ── counts derived from articles (source of truth) ── */
  const positiveCount = articles.filter(a => norm(a.ai?.sentiment) === 'positive').length
  const negativeCount = articles.filter(a => norm(a.ai?.sentiment) === 'negative').length
  const neutralCount  = articles.filter(a => norm(a.ai?.sentiment) === 'neutral').length
  const processedCount = articles.filter(a => a.ai?.sentiment).length

  /* ── filter ── */
  const filtered = articles.filter((a) => {
    const matchSearch    = a.title?.toLowerCase().includes(search.toLowerCase())
    const matchCat       = selectedCategory === 'all' || a.category === selectedCategory
    const matchSentiment = selectedSentiment === 'all' || norm(a.ai?.sentiment) === norm(selectedSentiment)
    return matchSearch && matchCat && matchSentiment
  })

  const totalPages   = Math.max(1, Math.ceil(filtered.length / ARTICLES_PER_PAGE))
  const safePage     = Math.min(currentPage, totalPages)
  const pageArticles = filtered.slice((safePage - 1) * ARTICLES_PER_PAGE, safePage * ARTICLES_PER_PAGE)

  /* ── chart data (also derived from articles) ── */
  const sentimentData = [
    { name: 'Positive', value: positiveCount },
    { name: 'Negative', value: negativeCount },
    { name: 'Neutral',  value: neutralCount  },
  ]
  const PCOLORS = [T.green, T.red, T.slate]

  const categoryData = categories.map((cat) => ({
    name:  cat,
    value: articles.filter((a) => a.category === cat).length,
  })).sort((a, b) => b.value - a.value)

  /* ── page range (show max 7 buttons) ── */
  const pageRange = (() => {
    const delta = 3
    const range = []
    for (let i = Math.max(1, safePage - delta); i <= Math.min(totalPages, safePage + delta); i++) range.push(i)
    return range
  })()

  return (
    <div style={{ background: T.bg, minHeight:'100vh', width:'100%', color: T.text,
      fontFamily:"'DM Sans', 'Segoe UI', sans-serif", overflowX:'hidden' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; min-height: 100vh; overflow-x: hidden; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${T.surface}; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
        select option { background: ${T.card}; color: ${T.text}; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .article-card:hover { transform: translateY(-4px) !important; box-shadow: 0 20px 40px rgba(0,0,0,0.5) !important; border-color: ${T.accent} !important; }
        .article-card { transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease !important; }
        .filter-input:focus { border-color: ${T.accent} !important; outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
        .nav-link { cursor:pointer; color:${T.muted}; font-size:13px; font-weight:500; letter-spacing:0.05em;
          text-transform:uppercase; padding:6px 0; border-bottom:2px solid transparent; transition:0.2s; }
        .nav-link:hover { color:${T.text}; border-bottom-color:${T.accent}; }
        .fetch-btn:hover { background:${T.accentDim} !important; transform:translateY(-1px); }
        .fetch-btn:active { transform:translateY(0); }
        .fetch-btn { transition:0.2s ease !important; }
        .page-btn:hover { background:${T.border} !important; }
        .stat-card { transition: transform 0.2s, box-shadow 0.2s; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{ background: T.surface, borderBottom:`1px solid ${T.border}`,
        position:'sticky', top:0, zIndex:100, padding:'0 40px', height:'64px', width:'100%',
        display:'flex', alignItems:'center', justifyContent:'space-between', boxSizing:'border-box' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ width:'32px', height:'32px', borderRadius:'8px', background: T.accent,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px' }}>⚡</div>
          <span style={{ fontWeight:700, fontSize:'17px', letterSpacing:'-0.02em' }}>NewsIntel</span>
        </div>
        <div style={{ display:'flex', gap:'32px', alignItems:'center' }}>
          {['Articles','Analytics','AI Insights','Global'].map(l => (
            <span key={l} className="nav-link">{l}</span>
          ))}
        </div>
      </nav>

      <div style={{ width:'100%', padding:'48px 40px', boxSizing:'border-box' }}>

        {/* ── HERO ── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end',
          marginBottom:'48px', gap:'20px', flexWrap:'wrap',
          animation:'fadeUp 0.5s ease both' }}>
          <div>
            <p style={{ color: T.accent, fontFamily:'DM Mono', fontSize:'11px',
              letterSpacing:'0.15em', marginBottom:'12px', textTransform:'uppercase' }}>
              AI-Powered Intelligence
            </p>
            <h1 style={{ fontSize:'clamp(32px,4vw,52px)', fontWeight:700, letterSpacing:'-0.03em',
              lineHeight:1.1, color: T.text }}>
              News Dashboard
            </h1>
            <p style={{ color: T.muted, fontSize:'15px', marginTop:'10px', fontWeight:400 }}>
              Real-time analytics & smart AI insights across {articles.length} articles
            </p>
          </div>
          <button className="fetch-btn" onClick={handlePipeline} disabled={running}
            style={{ background: running ? T.dim : T.accent, color:'white', border:'none',
              padding:'13px 24px', borderRadius:'10px', cursor: running?'not-allowed':'pointer',
              fontWeight:600, fontSize:'14px', display:'flex', alignItems:'center', gap:'8px',
              fontFamily:'inherit', whiteSpace:'nowrap' }}>
            {running
              ? <><span style={{ animation:'pulse 1s infinite' }}>●</span> Processing…</>
              : <><span>↻</span> Fetch Latest News</>}
          </button>
        </div>

        {/* ── STAT CARDS ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))',
          gap:'16px', marginBottom:'40px', animation:'fadeUp 0.5s 0.1s ease both' }}>
          {[
            { label:'Total Articles', value: articles.length,  color: T.accent },
            { label:'Positive',       value: positiveCount,   color: T.green  },
            { label:'Negative',       value: negativeCount,   color: T.red    },
            { label:'Processed',      value: processedCount,  color: T.muted  },
          ].map(({ label, value, color }) => (
            <div key={label} className="stat-card" style={{ background: T.card,
              borderRadius:'14px', border:`1px solid ${T.border}`, padding:'24px' }}>
              <p style={{ color: T.muted, fontSize:'11px', letterSpacing:'0.1em',
                textTransform:'uppercase', fontWeight:500, marginBottom:'10px' }}>{label}</p>
              <p style={{ fontSize:'40px', fontWeight:700, color, lineHeight:1 }}>
                {value ?? '—'}
              </p>
            </div>
          ))}
        </div>

        {/* ── CHARTS ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(420px, 1fr))',
          gap:'20px', marginBottom:'48px', animation:'fadeUp 0.5s 0.2s ease both' }}>
          <ChartCard title="Sentiment Distribution">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={sentimentData} dataKey="value" outerRadius={100} innerRadius={50}
                  paddingAngle={3} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                  labelLine={false}>
                  {sentimentData.map((_, i) => <Cell key={i} fill={PCOLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: T.card, border:`1px solid ${T.border}`,
                  borderRadius:'8px', color: T.text }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Articles by Category">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryData} layout="vertical" margin={{ left:10, right:20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fill: T.muted, fontSize:12 }}
                  width={90} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: T.card, border:`1px solid ${T.border}`,
                  borderRadius:'8px', color: T.text }} />
                <Bar dataKey="value" fill={T.accent} radius={[0,6,6,0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* ── FILTERS ── */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr',
          gap:'12px', marginBottom:'32px', animation:'fadeUp 0.5s 0.3s ease both' }}>
          <input className="filter-input" type="text" placeholder="🔍  Search articles…"
            value={search} onChange={e => setSearch(e.target.value)} style={inputStyle} />
          <select className="filter-input" value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)} style={inputStyle}>
            <option value="all">All Categories</option>
            {categories.map((c, i) => <option key={i} value={c}>{c}</option>)}
          </select>
          <select className="filter-input" value={selectedSentiment}
            onChange={e => setSelectedSentiment(e.target.value)} style={inputStyle}>
            <option value="all">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>

        {/* ── RESULTS HEADER ── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          marginBottom:'24px', flexWrap:'wrap', gap:'8px' }}>
          <h2 style={{ fontSize:'20px', fontWeight:600, letterSpacing:'-0.02em' }}>
            All Articles
          </h2>
          <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
            <span style={{ color: T.muted, fontSize:'13px', fontFamily:'DM Mono' }}>
              {filtered.length} results
            </span>
            <span style={{ color: T.dim, fontSize:'13px' }}>
              Page {safePage} of {totalPages}
            </span>
          </div>
        </div>

        {/* ── EMPTY STATE ── */}
        {filtered.length === 0 && (
          <div style={{ background: T.card, border:`1px solid ${T.border}`, borderRadius:'16px',
            padding:'64px', textAlign:'center', marginBottom:'40px' }}>
            <div style={{ fontSize:'48px', marginBottom:'16px' }}>🔎</div>
            <p style={{ color: T.text, fontSize:'18px', fontWeight:600, marginBottom:'8px' }}>
              No articles match your filters
            </p>
            <p style={{ color: T.muted, fontSize:'14px' }}>
              Try adjusting the search term, category, or sentiment filter.
            </p>
          </div>
        )}

        {/* ── ARTICLE GRID ── */}
        <div style={{ display:'grid',
          gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))',
          gap:'20px', marginBottom:'48px' }}>
          {pageArticles.map((article, i) => {
            const sentiment = norm(article.ai?.sentiment)
            const sColor = SENTIMENT_COLORS[sentiment] ?? T.slate
            return (
              <div key={i} className="article-card"
                style={{ background: T.card, borderRadius:'16px', overflow:'hidden',
                  border:`1px solid ${T.border}`, display:'flex', flexDirection:'column',
                  animation:`fadeUp 0.4s ${i * 0.03}s ease both` }}>
                {article.image_url && (
                  <div style={{ height:'180px', overflow:'hidden', position:'relative' }}>
                    <img src={article.image_url} alt="" style={{ width:'100%', height:'100%',
                      objectFit:'cover', display:'block' }} />
                    <div style={{ position:'absolute', inset:0,
                      background:'linear-gradient(to bottom, transparent 50%, rgba(17,24,39,0.9))' }} />
                  </div>
                )}
                <div style={{ padding:'20px', display:'flex', flexDirection:'column', flex:1 }}>

                  {/* badges */}
                  <div style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'center', marginBottom:'14px', gap:'8px' }}>
                    <span style={{ background:`${T.accent}22`, color: T.accent, padding:'4px 12px',
                      borderRadius:'20px', fontSize:'11px', fontWeight:600,
                      letterSpacing:'0.05em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
                      {article.category}
                    </span>
                    <span style={{ display:'flex', alignItems:'center', gap:'5px',
                      color: sColor, fontSize:'12px', fontWeight:500 }}>
                      <span style={{ width:'6px', height:'6px', borderRadius:'50%',
                        background: sColor, display:'inline-block' }} />
                      {sentiment || 'unknown'}
                    </span>
                  </div>

                  {/* title */}
                  <h3 style={{ fontSize:'16px', fontWeight:600, lineHeight:1.5,
                    marginBottom:'12px', letterSpacing:'-0.01em', color: T.text }}>
                    {article.title}
                  </h3>

                  {/* summary */}
                  <p style={{ color: T.muted, fontSize:'13px', lineHeight:1.7,
                    marginBottom:'16px', flex:1 }}>
                    {article.ai?.summary}
                  </p>

                  {/* key insights */}
                  {article.ai?.key_insights?.length > 0 && (
                    <div style={{ background: T.bg, borderRadius:'10px', padding:'14px',
                      marginBottom:'16px', border:`1px solid ${T.border}` }}>
                      <p style={{ color: T.muted, fontSize:'10px', letterSpacing:'0.1em',
                        textTransform:'uppercase', marginBottom:'10px', fontWeight:600 }}>
                        Key Insights
                      </p>
                      <ul style={{ paddingLeft:'16px', display:'flex', flexDirection:'column', gap:'6px' }}>
                        {article.ai.key_insights.slice(0, 3).map((ins, idx) => (
                          <li key={idx} style={{ color: T.muted, fontSize:'12px',
                            lineHeight:1.6 }}>{ins}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* CTA */}
                  <a href={article.url} target="_blank" rel="noreferrer"
                    style={{ textDecoration:'none', background: T.accent, color:'white',
                      padding:'11px', borderRadius:'10px', textAlign:'center',
                      fontWeight:600, fontSize:'13px', letterSpacing:'0.02em',
                      display:'block', transition:'background 0.2s',
                      marginTop:'auto' }}
                    onMouseEnter={e => e.target.style.background = T.accentDim}
                    onMouseLeave={e => e.target.style.background = T.accent}>
                    Read Full Article →
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── PAGINATION ── */}
        {totalPages > 1 && (
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center',
            gap:'8px', flexWrap:'wrap', paddingBottom:'40px' }}>
            <PagBtn disabled={safePage === 1} onClick={() => setCurrentPage(p => Math.max(p-1,1))}>
              ← Prev
            </PagBtn>
            {pageRange[0] > 1 && (
              <>
                <PagBtn onClick={() => setCurrentPage(1)}>1</PagBtn>
                {pageRange[0] > 2 && <span style={{ color: T.dim, padding:'0 4px' }}>…</span>}
              </>
            )}
            {pageRange.map(p => (
              <PagBtn key={p} active={p === safePage} onClick={() => setCurrentPage(p)}>{p}</PagBtn>
            ))}
            {pageRange[pageRange.length-1] < totalPages && (
              <>
                {pageRange[pageRange.length-1] < totalPages - 1 &&
                  <span style={{ color: T.dim, padding:'0 4px' }}>…</span>}
                <PagBtn onClick={() => setCurrentPage(totalPages)}>{totalPages}</PagBtn>
              </>
            )}
            <PagBtn disabled={safePage === totalPages} onClick={() => setCurrentPage(p => Math.min(p+1,totalPages))}>
              Next →
            </PagBtn>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── SUB-COMPONENTS ─────────────────────────────────────── */

function ChartCard({ title, children }) {
  return (
    <div style={{ background:'#0d1117', borderRadius:'14px',
      border:`1px solid #1f2937`, padding:'24px' }}>
      <p style={{ color:'#f1f5f9', fontWeight:600, fontSize:'15px',
        letterSpacing:'-0.01em', marginBottom:'20px' }}>{title}</p>
      {children}
    </div>
  )
}

function PagBtn({ children, active, disabled, onClick }) {
  return (
    <button className={active ? '' : 'page-btn'} onClick={onClick} disabled={disabled}
      style={{ background: active ? '#3b82f6' : '#111827', color: active ? 'white' : '#9ca3af',
        border:`1px solid ${active ? '#3b82f6' : '#1f2937'}`, padding:'9px 16px',
        borderRadius:'8px', cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight:600, fontSize:'13px', fontFamily:'inherit',
        opacity: disabled ? 0.4 : 1, transition:'0.15s',
        transform: active ? 'scale(1.05)' : 'scale(1)' }}>
      {children}
    </button>
  )
}

const inputStyle = {
  width:'100%', padding:'12px 16px', borderRadius:'10px',
  border:`1px solid #1f2937`, background:'#111827', color:'#f1f5f9',
  fontSize:'14px', fontFamily:"'DM Sans', 'Segoe UI', sans-serif",
  transition:'border-color 0.2s, box-shadow 0.2s',
}