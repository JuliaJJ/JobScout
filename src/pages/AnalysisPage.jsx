import { useState, useEffect } from 'react'
import { Zap, RefreshCw, ChevronDown, ChevronUp, PenLine } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { serialize } from '../lib/resumeUtils.js'

// ── Existing analysis components ───────────────────────────────────────────────

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

// ── Resume Workshop ────────────────────────────────────────────────────────────

function WorkshopCard({ skill, type, roles, structuredData, resumeId, onBulletAdded }) {
  const [description, setDescription] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [drafts, setDrafts] = useState([])
  const [selected, setSelected] = useState(null)
  const [expId, setExpId] = useState(roles[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const [savedTo, setSavedTo] = useState([])

  // Keep expId in sync if roles change after initial render
  useEffect(() => {
    if (!expId && roles[0]?.id) setExpId(roles[0].id)
  }, [roles])

  const typeStyle = type === 'partial'
    ? { bg: 'var(--maybe-bg)', text: 'var(--maybe)', border: '#fde68a', label: 'partially addressed' }
    : { bg: 'var(--no-bg)', text: 'var(--no)', border: '#fecaca', label: 'not on resume' }

  async function generateDrafts() {
    if (!description.trim()) return
    setDrafting(true)
    setDrafts([])
    setSelected(null)
    try {
      const res = await fetch('/api/draft-bullet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill,
          description: description.trim(),
          roles: roles.map(r => ({ title: r.title, company: r.company })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDrafts(data.bullets || [])
      if (data.bullets?.length) setSelected(0)
    } catch (e) {
      alert('Failed to draft bullets: ' + e.message)
    } finally {
      setDrafting(false)
    }
  }

  async function addToResume() {
    if (selected === null || !expId || !structuredData) return
    setSaving(true)
    try {
      const bullet = drafts[selected]
      const updated = {
        ...structuredData,
        experience: structuredData.experience.map(e =>
          e.id === expId
            ? { ...e, bullets: [...(e.bullets || []).filter(Boolean), bullet] }
            : e
        ),
      }
      const content = serialize(updated)
      await supabase
        .from('resume_versions')
        .update({ structured_data: updated, content })
        .eq('id', resumeId)
      const role = roles.find(r => r.id === expId)
      setSavedTo(prev => [...prev, `${role?.title || 'role'} at ${role?.company || ''}`])
      onBulletAdded(updated)
    } catch (e) {
      alert('Failed to save: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontWeight: 500, fontSize: 14 }}>{skill}</span>
        <span style={{
          fontSize: 10, fontFamily: 'DM Mono', padding: '2px 8px', borderRadius: 100,
          background: typeStyle.bg, color: typeStyle.text, border: `1px solid ${typeStyle.border}`,
        }}>
          {typeStyle.label}
        </span>
      </div>

      {/* Description input */}
      <label className="label" style={{ marginBottom: 4 }}>Describe your experience with this</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <textarea
          className="input"
          style={{ flex: 1, fontSize: 13, lineHeight: 1.6, minHeight: 64, resize: 'vertical' }}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={`How have you worked with ${skill}? Describe a specific project or situation — rough language is fine.`}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generateDrafts()
          }}
        />
        <button
          className="btn btn-secondary"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={generateDrafts}
          disabled={drafting || !description.trim()}
        >
          {drafting
            ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Drafting…</>
            : 'Draft bullets →'
          }
        </button>
      </div>
      {!drafting && !drafts.length && (
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>⌘ Enter to generate</p>
      )}

      {/* Draft options */}
      {drafts.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <label className="label" style={{ marginBottom: 6 }}>Pick a bullet</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {drafts.map((b, i) => (
              <div
                key={i}
                onClick={() => setSelected(i)}
                style={{
                  padding: '10px 14px', borderRadius: 6,
                  border: '1px solid',
                  borderColor: selected === i ? 'var(--accent)' : 'var(--border)',
                  background: selected === i ? '#fafaf8' : 'white',
                  cursor: 'pointer', fontSize: 13, lineHeight: 1.6,
                  color: 'var(--text-secondary)',
                  transition: 'border-color 0.1s',
                }}
              >
                {b}
              </div>
            ))}
          </div>

          {/* Add-to row */}
          <div style={{ marginTop: 12 }}>
            {roles.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Add to</span>
                <select
                  className="input"
                  style={{ flex: 1, fontSize: 13 }}
                  value={expId}
                  onChange={e => setExpId(e.target.value)}
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.title} at {r.company}</option>
                  ))}
                </select>
                <button
                  className="btn btn-primary"
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={addToResume}
                  disabled={saving || selected === null}
                >
                  {saving ? 'Saving…' : 'Add to resume'}
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Add experience entries on the Resume page to save bullets directly.
              </p>
            )}

            {savedTo.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {savedTo.map((name, i) => (
                  <p key={i} style={{ fontSize: 12, color: 'var(--yes)', fontFamily: 'DM Mono' }}>
                    ✓ Added to {name}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const [resume, setResume] = useState(null)
  const [listings, setListings] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pastAnalyses, setPastAnalyses] = useState([])
  const [liveStructured, setLiveStructured] = useState(null)

  useEffect(() => {
    async function load() {
      const [{ data: rv }, { data: jl }, { data: ga }] = await Promise.all([
        supabase.from('resume_versions').select('*').eq('is_active', true).single(),
        supabase.from('job_listings').select('*').eq('is_archived', false).neq('interest_rating', 'no'),
        supabase.from('gap_analyses').select('*').order('created_at', { ascending: false }).limit(5),
      ])
      setResume(rv)
      if (rv?.structured_data) setLiveStructured(rv.structured_data)
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

      let data
      try {
        data = await res.json()
      } catch {
        throw new Error('Analysis timed out — try again, or reduce the number of listings included.')
      }
      if (!res.ok) throw new Error(data.error)

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

  // Skills to address in the workshop: partial first (you do them, just unarticulated),
  // then missing (genuine gaps worth exploring)
  const workshopSkills = current ? [
    ...(current.skills_partial || []).map(s => ({ skill: s, type: 'partial' })),
    ...(current.skills_missing || []).map(s => ({ skill: s, type: 'missing' })),
  ] : []

  const hasStructuredExperience = liveStructured?.experience?.length > 0

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

          {/* Resume Workshop */}
          {workshopSkills.length > 0 && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <p className="section-header" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <PenLine size={11} /> Resume Workshop
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Describe your experience with each skill in plain language — get polished resume bullets back.
                  {!hasStructuredExperience && (
                    <span style={{ color: 'var(--maybe)', marginLeft: 6 }}>
                      Set up your structured resume to save bullets directly.
                    </span>
                  )}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {workshopSkills.map(({ skill, type }) => (
                  <WorkshopCard
                    key={skill}
                    skill={skill}
                    type={type}
                    roles={liveStructured?.experience || []}
                    structuredData={liveStructured}
                    resumeId={resume?.id}
                    onBulletAdded={updated => setLiveStructured(updated)}
                  />
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
