import { useState, useEffect } from 'react'
import { X, RefreshCw, Check, Copy, Save } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

export default function TailorResumeModal({ listing, onClose, onSaved }) {
  const [resume, setResume] = useState(null)
  const [resumeMissing, setResumeMissing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const existing = listing.resume_tailoring
  const [bullets, setBullets] = useState(existing?.bullet_rewrites || [])
  const [keywords, setKeywords] = useState(existing?.keywords || [])
  const [coaching, setCoaching] = useState(existing?.coaching || [])

  useEffect(() => {
    async function fetchResume() {
      const { data } = await supabase
        .from('resume_versions')
        .select('content')
        .eq('is_active', true)
        .single()
      if (data?.content) setResume(data.content)
      else setResumeMissing(true)
    }
    fetchResume()
  }, [])

  async function generate() {
    if (!resume) return
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/tailor-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing, resume }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      // Default all suggestions to accepted — user unchecks ones they don't want
      setBullets((data.bullet_rewrites || []).map(b => ({ ...b, id: crypto.randomUUID(), accepted: true })))
      setKeywords(data.keywords || [])
      setCoaching(data.coaching || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  function toggleBullet(id) {
    setBullets(prev => prev.map(b => b.id === id ? { ...b, accepted: !b.accepted } : b))
  }

  async function save() {
    setSaving(true)
    const tailoring = { bullet_rewrites: bullets, keywords, coaching }
    await supabase.from('job_listings').update({ resume_tailoring: tailoring }).eq('id', listing.id)
    setSaving(false)
    onSaved(tailoring)
  }

  async function copyAccepted() {
    const accepted = bullets.filter(b => b.accepted)
    if (!accepted.length) return
    await navigator.clipboard.writeText(accepted.map(b => b.suggestion).join('\n\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasContent = bullets.length > 0 || keywords.length > 0 || coaching.length > 0
  const acceptedCount = bullets.filter(b => b.accepted).length

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        className="card animate-in"
        style={{ width: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Resume tailoring</h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {listing.title}{listing.company ? ` · ${listing.company}` : ''}
            </p>
          </div>
          <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {resumeMissing ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            No active resume found. Save a resume on the Resume page first.
          </div>
        ) : (
          <>
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

              {!hasContent && !generating && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
                  Generate suggestions to see bullet rewrites and keyword opportunities for this role.
                </div>
              )}

              {/* Bullet rewrites */}
              {bullets.length > 0 && (
                <div>
                  <p className="section-header" style={{ marginBottom: 10 }}>Bullet rewrites</p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                    Click a suggestion to toggle it. Accepted ones can be copied to your clipboard.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {bullets.map(b => (
                      <div
                        key={b.id}
                        onClick={() => toggleBullet(b.id)}
                        style={{
                          border: `1px solid ${b.accepted ? 'var(--yes)' : 'var(--border)'}`,
                          background: b.accepted ? 'var(--yes-bg)' : 'var(--bg)',
                          borderRadius: 8,
                          padding: '12px 14px',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 3 }}>Before</p>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{b.original}</p>
                          </div>
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 14,
                            border: `2px solid ${b.accepted ? 'var(--yes)' : 'var(--border)'}`,
                            background: b.accepted ? 'var(--yes)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                          }}>
                            {b.accepted && <Check size={10} color="white" strokeWidth={3} />}
                          </div>
                        </div>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: b.accepted ? 'var(--yes)' : 'var(--text-tertiary)', marginBottom: 3 }}>After</p>
                          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: b.accepted ? 500 : 400 }}>{b.suggestion}</p>
                        </div>
                        {b.reason && (
                          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, fontStyle: 'italic' }}>
                            {b.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keywords */}
              {keywords.length > 0 && (
                <div>
                  <p className="section-header" style={{ marginBottom: 8 }}>Keywords to incorporate</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {keywords.map(k => (
                      <span key={k} className="skill-pill">{k}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Coaching notes */}
              {coaching.length > 0 && (
                <div>
                  <p className="section-header" style={{ marginBottom: 8 }}>Coaching notes</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {coaching.map((note, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, flexShrink: 0 }}>→</span>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p style={{ fontSize: 12, color: 'var(--no)', marginTop: 8 }}>{error}</p>
            )}

            {/* Footer actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <button
                className="btn btn-secondary"
                onClick={generate}
                disabled={generating || !resume}
                style={{ gap: 6 }}
              >
                {generating
                  ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Generating…</>
                  : <><RefreshCw size={12} /> {hasContent ? 'Regenerate' : 'Generate'}</>
                }
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                {acceptedCount > 0 && (
                  <button className="btn btn-secondary" onClick={copyAccepted} style={{ gap: 6 }}>
                    {copied
                      ? <><Check size={12} /> Copied</>
                      : <><Copy size={12} /> Copy {acceptedCount} bullet{acceptedCount !== 1 ? 's' : ''}</>
                    }
                  </button>
                )}
                {hasContent && (
                  <button className="btn btn-primary" onClick={save} disabled={saving} style={{ gap: 6 }}>
                    <Save size={12} />
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
