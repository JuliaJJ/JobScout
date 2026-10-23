import { useState, useEffect, useMemo } from 'react'
import { ClipboardCheck, RefreshCw, ChevronDown, ChevronUp, Check, AlertTriangle, ListChecks, Table2, UserCheck } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { RUBRIC_VERSION, CRITERIA, CRITERIA_BY_ID, AREAS, GRADE_WEIGHT, criteriaFor, summarize, PRIORITY_GAP } from '../lib/rubric.js'
import { runAudit, withSelfScores, scopeListings } from '../lib/auditRun.js'

// ── Small pieces ───────────────────────────────────────────────────────────────

const SCORE_STYLE = {
  2: { bg: 'var(--yes-bg)', text: 'var(--yes)', border: '#bbf7d0' },
  1: { bg: 'var(--maybe-bg)', text: 'var(--maybe)', border: '#fde68a' },
  0: { bg: 'var(--no-bg)', text: 'var(--no)', border: '#fecaca' },
}

const SOURCE_LABEL = { claude: 'Claude', pagespeed: 'PageSpeed', computed: 'JobScout data', self: 'Self-assessed' }

function ScorePill({ score, excluded }) {
  if (excluded) return <span className="badge badge-neutral">n/a</span>
  if (score === null || score === undefined) return <span className="badge badge-neutral">unscored</span>
  const s = SCORE_STYLE[score]
  return (
    <span className="badge" style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      {score}/2
    </span>
  )
}

function GradeBadge({ criterion, weight }) {
  const w = weight?.weight ?? GRADE_WEIGHT[criterion.grade]
  return (
    <span className="badge badge-neutral" title={weight?.boosted ? 'Boosted: the listings in scope ask for this' : `Evidence grade ${criterion.grade}`}>
      {criterion.grade} ×{w}{weight?.boosted ? ' ↑' : ''}
    </span>
  )
}

function CriterionDetail({ c, s }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 14px 52px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Meets the bar when: </strong>{c.bar}
      </p>
      {s?.evidence && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, background: '#0a0a0a05', border: '1px solid var(--border)',
          fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)',
        }}>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {s.source === 'self' ? 'Your notes' : 'Evidence'}
            {s.source === 'claude' && s.evidence_verified && <span style={{ color: 'var(--yes)', textTransform: 'none', letterSpacing: 0 }}><Check size={10} /> quote verified</span>}
            {s.lowest_study && <span style={{ textTransform: 'none', letterSpacing: 0 }}>· from "{s.lowest_study}"</span>}
          </p>
          {s.source === 'claude' ? <span style={{ fontStyle: 'italic' }}>“{s.evidence}”</span> : s.evidence}
        </div>
      )}
      {s?.fix && (
        <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
          <strong style={{ fontWeight: 600 }}>Fix: </strong>{s.fix}
        </p>
      )}
      {s?.note && (
        <p style={{ fontSize: 12, color: 'var(--maybe)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <AlertTriangle size={12} /> {s.note}
        </p>
      )}
      {s?.per_study?.length > 1 && (
        <div>
          <p className="label" style={{ marginBottom: 4 }}>By case study</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {s.per_study.map(ps => (
              <div key={ps.title} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12 }}>
                <ScorePill score={ps.score} />
                <span style={{ fontWeight: 500, minWidth: 160 }}>{ps.title}</span>
                <span style={{ color: 'var(--text-tertiary)', flex: 1 }}>{ps.score === 2 ? '' : ps.fix || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'DM Mono' }}>
        Scored by {SOURCE_LABEL[s?.source] || '—'}
      </p>
    </div>
  )
}

function CriterionRow({ c, s, weight, gap, index }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <span style={{
          minWidth: 28, height: 24, borderRadius: 12, padding: '0 6px',
          background: gap ? 'var(--bg)' : 'transparent', border: gap ? '1px solid var(--border)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontFamily: 'DM Mono', fontWeight: 600, flexShrink: 0,
        }} title={gap !== undefined ? 'Gap = weight × (2 − score)' : ''}>
          {index !== undefined ? index + 1 : c.id}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {index !== undefined && <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-tertiary)' }}>{c.id}</span>}
            <span style={{ fontWeight: 500, fontSize: 14 }}>{c.criterion}</span>
          </div>
          {!open && s?.fix && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.fix}</p>
          )}
        </div>
        {gap !== undefined && <span style={{ fontSize: 11, fontFamily: 'DM Mono', color: 'var(--no)' }}>gap {gap}</span>}
        <GradeBadge criterion={c} weight={weight} />
        <ScorePill score={s?.score} excluded={s?.excluded} />
        {open ? <ChevronUp size={14} color="var(--text-tertiary)" /> : <ChevronDown size={14} color="var(--text-tertiary)" />}
      </div>
      {open && <CriterionDetail c={c} s={s} />}
    </div>
  )
}

function SkillGapRow({ item, gap, index }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <span style={{
          minWidth: 28, height: 24, borderRadius: 12, padding: '0 6px', background: 'var(--bg)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: 'DM Mono', fontWeight: 600, flexShrink: 0,
        }}>{index + 1}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 500, fontSize: 14 }}>{item.action}</span>
          {!open && item.rationale && <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{item.rationale}</p>}
        </div>
        <span style={{ fontSize: 11, fontFamily: 'DM Mono', color: 'var(--no)' }} title="Mapped from Gap Analysis priority">≈ gap {gap}</span>
        <span className="badge badge-neutral">skills · {item.priority}</span>
        {open ? <ChevronUp size={14} color="var(--text-tertiary)" /> : <ChevronDown size={14} color="var(--text-tertiary)" />}
      </div>
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 14px 52px' }}>
          {item.rationale && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>{item.rationale}</p>}
          {item.detail && <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{item.detail}</p>}
          {item.resume_suggestion && (
            <p style={{ marginTop: 8, fontFamily: 'DM Mono', fontSize: 12, color: 'var(--text-secondary)' }}>{item.resume_suggestion}</p>
          )}
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'DM Mono', marginTop: 8 }}>From your latest Gap Analysis</p>
        </div>
      )}
    </div>
  )
}

function SelfScoreRow({ c, value, onSave }) {
  const [notes, setNotes] = useState(value?.notes || '')
  useEffect(() => { setNotes(value?.notes || '') }, [value?.notes])
  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-tertiary)', minWidth: 24, paddingTop: 2 }}>{c.id}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 500, fontSize: 14 }}>{c.criterion}</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{c.bar}</p>
          <input
            className="input"
            style={{ marginTop: 8, fontSize: 12 }}
            placeholder="Notes (optional): what's done, what's left"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => notes !== (value?.notes || '') && onSave(c.id, value?.score ?? null, notes)}
          />
        </div>
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg)', borderRadius: 8, padding: 3, border: '1px solid var(--border)', flexShrink: 0 }}>
          {[0, 1, 2].map(n => {
            const active = value?.score === n
            const st = SCORE_STYLE[n]
            return (
              <button key={n} onClick={() => onSave(c.id, active ? null : n, notes)}
                aria-pressed={active}
                style={{
                  width: 32, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontFamily: 'DM Mono', fontSize: 12, fontWeight: 600,
                  background: active ? st.bg : 'transparent', color: active ? st.text : 'var(--text-tertiary)',
                  boxShadow: active ? `inset 0 0 0 1px ${st.border}` : 'none',
                }}>
                {n}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ChangesCard({ changes, previous, current }) {
  const [open, setOpen] = useState(false)
  const fmt = v => (v === null ? '—' : v)
  const prevPct = previous.max_points ? Math.round((previous.points / previous.max_points) * 100) : null
  const sameInputs = JSON.stringify(previous.featured_piece_ids || []) === JSON.stringify(current.featured_piece_ids || [])
    && previous.resume_version_id === current.resume_version_id
    && (previous.scope || 'general') === (current.scope || 'general')
    && (previous.listing_id || null) === (current.listing_id || null)
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <span style={{ fontWeight: 500, fontSize: 14, flex: 1 }}>
          {changes.length} score{changes.length === 1 ? '' : 's'} changed since {new Date(previous.created_at).toLocaleString()}
          {prevPct !== null && <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> (was {prevPct}%)</span>}
        </span>
        {open ? <ChevronUp size={14} color="var(--text-tertiary)" /> : <ChevronDown size={14} color="var(--text-tertiary)" />}
      </div>
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sameInputs && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Same resume, featured studies and scope as last time, so these changes come from scoring variation or from content edited in JobScout.
            </p>
          )}
          {changes.map(({ c, before, after, delta }) => (
            <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-tertiary)', minWidth: 28 }}>{c.id}</span>
              <span style={{ flex: 1 }}>{c.criterion}</span>
              <span style={{ fontFamily: 'DM Mono', fontSize: 12 }}>{fmt(before)} → {fmt(after)}</span>
              <span style={{ fontFamily: 'DM Mono', fontSize: 12, minWidth: 36, textAlign: 'right', color: delta > 0 ? 'var(--yes)' : delta < 0 ? 'var(--no)' : 'var(--text-tertiary)' }}>
                {delta > 0 ? '+' : ''}{delta}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const [profile, setProfile] = useState(null)
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [pieces, setPieces] = useState([])
  const [resume, setResume] = useState(null)
  const [listings, setListings] = useState([])
  const [stories, setStories] = useState([])
  const [selfScores, setSelfScores] = useState({})
  const [latestGap, setLatestGap] = useState(null)
  const [pastAudits, setPastAudits] = useState([])
  const [current, setCurrent] = useState(null)
  const [scope, setScope] = useState('general')
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState({})
  const [tab, setTab] = useState('plan') // plan | all | self
  const [includeSkills, setIncludeSkills] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    async function load() {
      const [pr, pp, rv, jl, st, ss, ga, ra] = await Promise.all([
        supabase.from('profile').select('*').limit(1).maybeSingle(),
        supabase.from('portfolio_pieces').select('*').order('created_at', { ascending: true }),
        supabase.from('resume_versions').select('*').eq('is_active', true).maybeSingle(),
        supabase.from('job_listings').select('*').eq('is_archived', false).neq('interest_rating', 'no'),
        supabase.from('interview_stories').select('*'),
        supabase.from('rubric_self_scores').select('*'),
        supabase.from('gap_analyses').select('*').order('created_at', { ascending: false }).limit(1),
        supabase.from('rubric_audits').select('*').order('created_at', { ascending: false }).limit(10),
      ])
      if (ra.error || ss.error) {
        setLoadError('The rubric tables are missing. Run supabase-migration-rubric-audit.sql in the Supabase SQL editor, then reload.')
      }
      setProfile(pr.data)
      setPortfolioUrl(pr.data?.portfolio_url || '')
      setPieces(pp.data || [])
      setResume(rv.data)
      setListings(jl.data || [])
      setStories(st.data || [])
      setSelfScores(Object.fromEntries((ss.data || []).map(r => [r.criterion_id, r])))
      setLatestGap(ga.data?.[0] || null)
      setPastAudits(ra.data || [])
      if (ra.data?.[0]) setCurrent(ra.data[0])
    }
    load()
  }, [])

  async function savePortfolioUrl() {
    const url = portfolioUrl.trim()
    if ((profile?.portfolio_url || '') === url) return
    if (profile?.id) {
      await supabase.from('profile').update({ portfolio_url: url || null, updated_at: new Date().toISOString() }).eq('id', profile.id)
      setProfile({ ...profile, portfolio_url: url })
    } else {
      const { data } = await supabase.from('profile').insert({ portfolio_url: url || null }).select().single()
      setProfile(data)
    }
  }

  async function toggleFeatured(piece) {
    const featured = !piece.featured
    setPieces(prev => prev.map(p => (p.id === piece.id ? { ...p, featured } : p)))
    const { error } = await supabase.from('portfolio_pieces').update({ featured }).eq('id', piece.id)
    if (error) {
      setPieces(prev => prev.map(p => (p.id === piece.id ? { ...p, featured: !featured } : p)))
      alert('Could not save: ' + error.message)
    }
  }

  async function saveSelfScore(id, score, notes) {
    const row = { criterion_id: id, score, notes: notes || null, updated_at: new Date().toISOString() }
    const next = { ...selfScores, [id]: row }
    setSelfScores(next)
    const { error } = await supabase.from('rubric_self_scores').upsert(row)
    if (error) { alert('Could not save: ' + error.message); return }
    // Keep the saved audit's totals in step with self-assessments.
    if (current) {
      const scores = withSelfScores(current.scores || {}, next)
      const sum = summarize(scores, current.weights || {})
      setCurrent(prev => ({ ...prev, scores, points: sum.points, max_points: sum.max }))
      await supabase.from('rubric_audits').update({ scores, points: sum.points, max_points: sum.max }).eq('id', current.id)
    }
  }

  async function run() {
    setRunning(true)
    setSteps({})
    try {
      const result = await runAudit({
        scope, listings, pieces, resume, portfolioUrl: portfolioUrl.trim(), stories, selfScores,
        onStep: (key, patch) => setSteps(prev => ({ ...prev, [key]: patch })),
      })
      const sum = summarize(result.scores, result.weights)
      const row = {
        rubric_version: RUBRIC_VERSION,
        scope: scope === 'general' ? 'general' : 'listing',
        listing_id: scope === 'general' ? null : scope,
        resume_version_id: resume?.id || null,
        portfolio_url: portfolioUrl.trim() || null,
        featured_piece_ids: result.featuredIds,
        scores: result.scores,
        weights: result.weights,
        psi: result.psi,
        points: sum.points,
        max_points: sum.max,
        errors: result.errors,
      }
      const { data, error } = await supabase.from('rubric_audits').insert(row).select().single()
      const saved = data || { ...row, id: null, created_at: new Date().toISOString() }
      if (error) alert('Audit finished but could not be saved: ' + error.message)
      setCurrent(saved)
      if (data) setPastAudits(prev => [data, ...prev].slice(0, 10))
      setTab('plan')
    } catch (e) {
      alert(e.message)
    } finally {
      setRunning(false)
    }
  }

  const featuredCount = pieces.filter(p => p.featured).length
  const inScopeCount = scopeListings(listings, scope).length
  const scores = useMemo(() => (current ? withSelfScores(current.scores || {}, selfScores) : null), [current, selfScores])
  const weights = useMemo(() => current?.weights || {}, [current])
  const summary = useMemo(() => (scores ? summarize(scores, weights) : null), [scores, weights])

  const plan = useMemo(() => {
    if (!summary) return []
    const items = summary.gaps.map(g => ({ kind: 'rubric', ...g }))
    if (includeSkills && latestGap?.action_plan?.length) {
      latestGap.action_plan.forEach((a, i) => items.push({ kind: 'skills', id: `skills-${i}`, gap: PRIORITY_GAP[a.priority] || 2, item: a }))
    }
    return items.sort((a, b) => b.gap - a.gap || (a.kind === 'rubric' ? -1 : 1))
  }, [summary, includeSkills, latestGap])

  // Compare with the previous saved audit so score changes can be explained.
  const previous = useMemo(() => {
    if (!current?.created_at) return null
    return pastAudits.find(a => a.id !== current.id && new Date(a.created_at) < new Date(current.created_at)) || null
  }, [current, pastAudits])
  const changes = useMemo(() => {
    if (!previous || !scores) return []
    const prevScores = withSelfScores(previous.scores || {}, selfScores)
    return CRITERIA.map(c => {
      const before = prevScores[c.id]?.excluded ? null : prevScores[c.id]?.score ?? null
      const after = scores[c.id]?.excluded ? null : scores[c.id]?.score ?? null
      const w = weights[c.id]?.weight ?? GRADE_WEIGHT[c.grade]
      return { c, before, after, delta: (after ?? 0) * w - (before ?? 0) * w }
    }).filter(x => x.before !== x.after)
  }, [previous, scores, weights, selfScores])
  const protectedIds = scores ? CRITERIA.filter(c => scores[c.id]?.unscored_reason === 'protected').map(c => c.id) : []
  const unscoredSelf = criteriaFor('self').filter(c => selfScores[c.id]?.score === null || selfScores[c.id]?.score === undefined).length
  const scopeLabel = a => (a.scope === 'listing'
    ? (() => { const l = listings.find(x => x.id === a.listing_id); return l ? `${l.title} · ${l.company}` : 'One listing' })()
    : 'General')

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Rubric Audit</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 2 }}>
            {resume ? `Resume: ${resume.label}` : '⚠ No active resume'} · {featuredCount} featured case stud{featuredCount === 1 ? 'y' : 'ies'} · scored against {inScopeCount} listing{inScopeCount === 1 ? '' : 's'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={running || !!loadError}>
          {running
            ? <><span className="spinner" /> Auditing…</>
            : <><ClipboardCheck size={13} /> {current ? <><RefreshCw size={12} /> Re-run audit</> : 'Run audit'}</>}
        </button>
      </div>

      {loadError && (
        <div className="card" style={{ padding: 16, marginBottom: 20, borderColor: '#fecaca', background: 'var(--no-bg)', color: 'var(--no)', fontSize: 13 }}>
          {loadError}
        </div>
      )}

      {/* Setup */}
      <div className="card" style={{ padding: 20, marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Portfolio homepage</label>
            <input className="input" type="url" placeholder="https://juliewithej.com" value={portfolioUrl}
              onChange={e => setPortfolioUrl(e.target.value)} onBlur={savePortfolioUrl} />
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Used for homepage, speed and accessibility checks.</p>
          </div>
          <div>
            <label className="label">Score against</label>
            <select className="input" value={scope} onChange={e => setScope(e.target.value)}>
              <option value="general">General — your yes-rated listings</option>
              {listings.map(l => <option key={l.id} value={l.id}>{l.title} · {l.company}</option>)}
            </select>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
              Sets the target role and raises the weight of C-grade items the listings ask for.
            </p>
          </div>
        </div>
        <div>
          <label className="label">Featured case studies ({featuredCount}) — aim for 3–5</label>
          {pieces.length === 0
            ? <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Add pieces on the Portfolio page first.</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                {pieces.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>
                    <input type="checkbox" checked={!!p.featured} onChange={() => toggleFeatured(p)} />
                    <span style={{ flex: 1 }}>{p.title}</span>
                    <span className="badge badge-neutral">{p.type}</span>
                    {!p.mdx_content && !p.description && <span style={{ fontSize: 11, color: 'var(--maybe)' }}>no content</span>}
                  </label>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Progress */}
      {Object.keys(steps).length > 0 && (running || Object.values(steps).some(s => s.status === 'error')) && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <p className="section-header" style={{ marginBottom: 10 }}>{running ? 'Scoring…' : 'Some steps failed'}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(steps).map(([key, s]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                {s.status === 'running' && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
                {s.status === 'done' && <Check size={13} color="var(--yes)" />}
                {s.status === 'error' && <AlertTriangle size={13} color="var(--no)" />}
                <span style={{ color: s.status === 'error' ? 'var(--no)' : 'var(--text-secondary)' }}>
                  {s.label}{s.error ? ` — ${s.error}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!current && !running && !loadError && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          Mark your featured case studies, add your portfolio URL, then run the audit.
          It takes about a minute and scores {CRITERIA.length} criteria.
        </div>
      )}

      {current && summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="animate-in">
          {protectedIds.length > 0 && (
            <div className="card" style={{ padding: '12px 16px', background: 'var(--bg)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Password-protected portfolio.</strong>{' '}
              {protectedIds.length} live-site criteria ({protectedIds.join(', ')}) are unscored and left out of the totals.
              Case studies are still scored from the content saved in JobScout. Check the live-site items by hand when you share your link.
            </div>
          )}
          {/* Summary */}
          <div className="card" style={{ padding: 20, display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
            <div>
              <p className="section-header" style={{ marginBottom: 8 }}>Overall</p>
              <p style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>{summary.pct}%</p>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'DM Mono', marginTop: 6 }}>
                {summary.points} / {summary.max} weighted points
              </p>
              <p style={{ fontSize: 12, color: summary.pct >= 80 && !summary.weakA.length ? 'var(--yes)' : 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5 }}>
                Target: 80%+ with every A item at 2.
                {summary.weakA.length > 0 && <> A items below 2: <strong>{summary.weakA.join(', ')}</strong></>}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {summary.areas.map(a => {
                const pct = a.max ? a.points / a.max : 0
                return (
                  <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '210px 1fr 90px', alignItems: 'center', gap: 12, fontSize: 13 }}>
                    <span>{a.label}</span>
                    <div style={{ height: 6, background: 'var(--bg)', borderRadius: 3, border: '1px solid var(--border)', overflow: 'hidden' }}
                      role="img" aria-label={`${a.label}: ${a.points} of ${a.max}`}>
                      <div style={{ width: `${pct * 100}%`, height: '100%', background: pct >= 0.8 ? 'var(--yes)' : pct >= 0.5 ? 'var(--maybe)' : 'var(--no)' }} />
                    </div>
                    <span style={{ fontFamily: 'DM Mono', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
                      {a.points}/{a.max}{a.unscored ? ` · ${a.unscored}?` : ''}
                    </span>
                  </div>
                )
              })}
              {unscoredSelf > 0 && (
                <p style={{ fontSize: 12, color: 'var(--maybe)', marginTop: 4 }}>
                  {unscoredSelf} self-assessed item{unscoredSelf === 1 ? '' : 's'} still unscored ("?") — score them on the Self-assessment tab.
                </p>
              )}
            </div>
          </div>

          {changes.length > 0 && <ChangesCard changes={changes} previous={previous} current={current} />}

          {/* Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg)', borderRadius: 8, padding: 3, border: '1px solid var(--border)' }}>
              {[['plan', 'Action plan', ListChecks], ['all', 'All criteria', Table2], ['self', 'Self-assessment', UserCheck]].map(([v, label, Icon]) => (
                <button key={v} onClick={() => setTab(v)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', border: 'none', transition: 'all 0.12s',
                  background: tab === v ? 'white' : 'transparent',
                  color: tab === v ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  boxShadow: tab === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
            {tab === 'plan' && latestGap?.action_plan?.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeSkills} onChange={e => setIncludeSkills(e.target.checked)} />
                Include skill gaps from latest Gap Analysis
              </label>
            )}
          </div>

          {tab === 'plan' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                Ordered by gap = weight × (2 − score). Skill gaps from Gap Analysis are mapped by priority (high ≈ 6, medium ≈ 4, low ≈ 2).
              </p>
              {plan.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>No gaps — every scored item meets the bar.</p>}
              {plan.map((p, i) => p.kind === 'rubric'
                ? <CriterionRow key={p.id} index={i} c={CRITERIA_BY_ID[p.id]} s={scores[p.id]} weight={weights[p.id]} gap={p.gap} />
                : <SkillGapRow key={p.id} index={i} item={p.item} gap={p.gap} />)}
            </div>
          )}

          {tab === 'all' && AREAS.map(a => (
            <div key={a.id}>
              <p className="section-header" style={{ marginBottom: 8 }}>{a.label}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CRITERIA.filter(c => c.area === a.id).map(c => (
                  <CriterionRow key={c.id} c={c} s={scores[c.id]} weight={weights[c.id]} />
                ))}
              </div>
            </div>
          ))}

          {tab === 'self' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                These need a human eye. Scores save immediately and carry over to future audits. Ask a peer to score Q1 and Q2 cold.
              </p>
              {criteriaFor('self').map(c => (
                <SelfScoreRow key={c.id} c={c} value={selfScores[c.id]} onSave={saveSelfScore} />
              ))}
            </div>
          )}

          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'DM Mono', textAlign: 'right' }}>
            Rubric {current.rubric_version} · {scopeLabel(current)} · {new Date(current.created_at).toLocaleString()}
            {current.psi && ` · PageSpeed mobile ${current.psi.performance ?? '—'} perf / ${current.psi.accessibility ?? '—'} a11y`}
          </p>
        </div>
      )}

      {/* History */}
      {pastAudits.length > 1 && (
        <div className="card" style={{ padding: 16, marginTop: 20 }}>
          <p className="section-header" style={{ marginBottom: 12 }}>Audit history</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pastAudits.map((a, i) => {
              const pct = a.max_points ? Math.round((a.points / a.max_points) * 100) : 0
              const prev = pastAudits[i + 1]
              const prevPct = prev?.max_points ? Math.round((prev.points / prev.max_points) * 100) : null
              const delta = prevPct === null ? null : pct - prevPct
              return (
                <button key={a.id} onClick={() => { setCurrent(a); setTab('plan') }} style={{
                  textAlign: 'left', padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                  border: `1px solid ${current?.id === a.id ? 'var(--accent)' : 'var(--border)'}`, background: 'white',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                }}>
                  <span style={{ fontSize: 13 }}>{new Date(a.created_at).toLocaleString()} · {scopeLabel(a)}</span>
                  <span style={{ fontSize: 12, fontFamily: 'DM Mono', color: 'var(--text-secondary)' }}>
                    {pct}%{delta !== null && delta !== 0 && (
                      <span style={{ color: delta > 0 ? 'var(--yes)' : 'var(--no)', marginLeft: 6 }}>{delta > 0 ? '+' : ''}{delta}</span>
                    )}
                    {a.rubric_version !== RUBRIC_VERSION && <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>old rubric</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
