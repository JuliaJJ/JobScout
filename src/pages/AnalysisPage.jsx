import { useState, useEffect } from 'react'
import { Zap, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

function ActionItem({ item, index }) {
  const [open, setOpen] = useState(false)
  const priorityColor = item.priority === 'high' ? 'var(--no)' : item.priority === 'medium' ? 'var(--maybe)' : 'var(--text-tertiary)'

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}
        onClick={() => setOpen(!open)}>
        <span style={{
          minWidth: 24, height: 24, borderRadius: '50%',
          background: 'var(--bg)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontFamily: 'DM Mono', fontWeight: 600, flexShrink: 0,
        }}>{index + 1}</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>{item.action}</span>
            <span style={{ fontSize: 11, color: priorityColor, fontFamily: 'DM Mono' }}>{item.priority}</span>
          </div>
          {item.rationale && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{item.rationale}</p>
          )}
        </div>
        {open ? <ChevronUp size={14} color="var(--text-tertiary)" /> : <ChevronDown size={14} color="var(--text-tertiary)" />}
      </div>
      {open && item.detail && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 14px 52px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{item.detail}</p>
          {item.resume_suggestion && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 6,
              background: '#0a0a0a05', border: '1px solid var(--border)',
              fontFamily: 'DM Mono', fontSize: 12, lineHeight: 1.7,
              color: 'var(--text-secondary)',
            }}>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, color: 'var(--text-tertiary)' }}>
                Suggested resume language
              </p>
              {item.resume_suggestion}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SkillsGrid({ skills, type }) {
  const colors = {
    present: { bg: 'var(--yes-bg)', text: 'var(--yes)', border: '#bbf7d0' },
    missing: { bg: 'var(--no-bg)', text: 'var(--no)', border: '#fecaca' },
    partial: { bg: 'var(--maybe-bg)', text: 'var(--maybe)', border: '#fde68a' },
  }
  const c = colors[type]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {skills.map(s => (
        <span key={s} style={{
          padding: '3px 10px', borderRadius: 100, fontSize: 12,
          fontFamily: 'DM Mono', background: c.bg, color: c.text,
          border: `1px solid ${c.border}`,
        }}>{s}</span>
      ))}
    </div>
  )
}

export default function AnalysisPage() {
  const [resume, setResume] = useState(null)
  const [listings, setListings] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pastAnalyses, setPastAnalyses] = useState([])

  useEffect(() => {
    async function load() {
      const [{ data: rv }, { data: jl }, { data: ga }] = await Promise.all([
        supabase.from('resume_versions').select('*').eq('is_active', true).single(),
        supabase.from('job_listings').select('*').eq('is_archived', false).neq('interest_rating', 'no'),
        supabase.from('gap_analyses').select('*').order('created_at', { ascending: false }).limit(5),
      ])
      setResume(rv)
      setListings(jl || [])
      setPastAnalyses(ga || [])
    }
    load()
  }, [])

  async function runAnalysis() {
    if (!resume || listings.length === 0) return
    setLoading(true)

    try {
      const res = await fetch('/api/gap-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume: resume.content,
          listings: listings.map(l => ({
            title: l.title,
            company: l.company,
            skills: l.parsed_skills,
            requirements: l.parsed_requirements,
            nice_to_haves: l.parsed_nice_to_haves,
            seniority_level: l.seniority_level,
            role_cluster: l.role_cluster,
            interest_rating: l.interest_rating,
          }))
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Save to DB
      const { data: saved } = await supabase.from('gap_analyses').insert({
        resume_version_id: resume.id,
        listing_count: listings.length,
        analysis_text: data.summary,
        skills_present: data.skills_present || [],
        skills_missing: data.skills_missing || [],
        skills_partial: data.skills_partial || [],
        action_plan: data.action_plan || [],
      }).select().single()

      setAnalysis(saved)
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  function loadPast(ga) {
    setAnalysis(ga)
  }

  const hasData = resume && listings.length > 0
  const current = analysis

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Gap Analysis</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 2 }}>
            {resume ? `Resume: ${resume.label}` : '⚠ No resume saved'} ·{' '}
            {listings.filter(l => !l.application_status).length} research
            {listings.filter(l => l.application_status).length > 0 &&
              ` + ${listings.filter(l => l.application_status).length} pipeline`
            } listings included
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={runAnalysis}
          disabled={loading || !hasData}
          title={!hasData ? 'Add a resume and some listings first' : ''}
        >
          {loading
            ? <><span className="spinner" /> Analysing…</>
            : <><Zap size={13} /> {current ? <><RefreshCw size={12} /> Re-run</> : 'Run analysis'}</>
          }
        </button>
      </div>

      {!hasData && (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          {!resume && <p style={{ marginBottom: 8 }}>→ Save your resume on the Resume tab</p>}
          {listings.length === 0 && <p>→ Add and rate some listings on the Listings tab</p>}
        </div>
      )}

      {/* Past analyses */}
      {pastAnalyses.length > 0 && !current && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <p className="section-header" style={{ marginBottom: 12 }}>Previous analyses</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pastAnalyses.map(ga => (
              <button key={ga.id} onClick={() => loadPast(ga)}
                style={{
                  textAlign: 'left', padding: '8px 12px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'white', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                <span style={{ fontSize: 13 }}>{new Date(ga.created_at).toLocaleString()}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'DM Mono' }}>
                  {ga.listing_count} listings · {ga.action_plan?.length || 0} actions
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {current && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="animate-in">
          {/* Summary */}
          {current.analysis_text && (
            <div className="card" style={{ padding: 20 }}>
              <p className="section-header" style={{ marginBottom: 12 }}>Summary</p>
              <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {current.analysis_text}
              </p>
            </div>
          )}

          {/* Skills grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { label: 'Skills you have', type: 'present', data: current.skills_present },
              { label: 'Partial / implicit', type: 'partial', data: current.skills_partial },
              { label: 'Skills to develop', type: 'missing', data: current.skills_missing },
            ].map(({ label, type, data }) => (
              <div key={type} className="card" style={{ padding: 16 }}>
                <p className="section-header" style={{ marginBottom: 12 }}>{label}</p>
                {data?.length > 0
                  ? <SkillsGrid skills={data} type={type} />
                  : <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>None identified</p>
                }
              </div>
            ))}
          </div>

          {/* Action plan */}
          {current.action_plan?.length > 0 && (
            <div>
              <p className="section-header" style={{ marginBottom: 12 }}>Action plan · ordered by impact</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {current.action_plan.map((item, i) => (
                  <ActionItem key={i} item={item} index={i} />
                ))}
              </div>
            </div>
          )}

          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'DM Mono', textAlign: 'right' }}>
            Generated {new Date(current.created_at).toLocaleString()} · {current.listing_count} listings
          </p>
        </div>
      )}
    </div>
  )
}
