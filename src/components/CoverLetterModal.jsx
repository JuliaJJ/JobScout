import { useState, useEffect } from 'react'
import { Copy, Check, RefreshCw, Save, X } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

export default function CoverLetterModal({ listing, onClose, onSaved }) {
  const [resume, setResume] = useState(null)
  const [text, setText] = useState(listing.cover_letter || '')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [resumeMissing, setResumeMissing] = useState(false)

  useEffect(() => {
    async function fetchResume() {
      const { data } = await supabase
        .from('resume_versions')
        .select('content')
        .eq('is_active', true)
        .single()
      if (data?.content) {
        setResume(data.content)
      } else {
        setResumeMissing(true)
      }
    }
    fetchResume()
  }, [])

  async function generate() {
    if (!resume) return
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, listing }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setText(data.cover_letter)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    setSaving(true)
    await supabase
      .from('job_listings')
      .update({ cover_letter: text })
      .eq('id', listing.id)
    setSaving(false)
    onSaved?.(text)
  }

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasContent = text.trim().length > 0
  const isExisting = !!listing.cover_letter

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card animate-in"
        style={{ width: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Cover letter</h2>
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
            {/* Textarea */}
            <textarea
              className="input"
              style={{
                flex: 1,
                minHeight: 200,
                maxHeight: 'calc(70vh - 160px)',
                overflowY: 'auto',
                fontFamily: 'DM Mono',
                fontSize: 12,
                lineHeight: 1.8,
                resize: 'none',
              }}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={
                resume
                  ? 'Click "Generate" to create a tailored cover letter, or type your own.'
                  : 'Loading resume…'
              }
              disabled={generating}
            />

            {error && (
              <p style={{ fontSize: 12, color: 'var(--no)', marginTop: 8 }}>{error}</p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 16 }}>
              <button
                className="btn btn-secondary"
                onClick={generate}
                disabled={generating || !resume}
                style={{ gap: 6 }}
              >
                {generating ? (
                  <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Generating…</>
                ) : (
                  <><RefreshCw size={12} /> {isExisting || hasContent ? 'Regenerate' : 'Generate'}</>
                )}
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                {hasContent && (
                  <button className="btn btn-secondary" onClick={copy} style={{ gap: 6 }}>
                    {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={save}
                  disabled={saving || !hasContent}
                  style={{ gap: 6 }}
                >
                  <Save size={12} />
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
