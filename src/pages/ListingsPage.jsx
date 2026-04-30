import { useState, useEffect } from 'react'
import { Plus, ExternalLink, Trash2, ChevronDown, ChevronUp, Link, AlignLeft, Send } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

const CLUSTERS = ['ux', 'product-design', 'design-engineer', 'design-technologist', 'other']
const RATINGS = ['yes', 'maybe', 'no']

function AddListingModal({ onClose, onAdded }) {
  const [mode, setMode] = useState('url') // 'url' | 'paste'
  const [url, setUrl] = useState('')
  const [pastedText, setPastedText] = useState('')
  const [sourceUrl, setSourceUrl] = useState('') // optional URL to store alongside pasted text
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    const isUrl = mode === 'url'
    if (isUrl && !url.trim()) return
    if (!isUrl && !pastedText.trim()) return

    setLoading(true)
    setError('')
    try {
      const body = isUrl
        ? { url: url.trim() }
        : { text: pastedText.trim(), source_url: sourceUrl.trim() || null }

      const res = await fetch('/api/fetch-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to parse listing')

      const { error: dbErr } = await supabase.from('job_listings').insert({
        url: isUrl ? url.trim() : (sourceUrl.trim() || 'pasted'),
        title: data.title,
        company: data.company,
        location: data.location,
        raw_text: data.raw_text,
        parsed_skills: data.skills || [],
        parsed_requirements: data.requirements || [],
        parsed_nice_to_haves: data.nice_to_haves || [],
        seniority_level: data.seniority_level,
        role_cluster: data.role_cluster,
      })
      if (dbErr) throw dbErr
      onAdded()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const tabStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', border: 'none', transition: 'all 0.12s',
    background: active ? 'white' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
  })

  const canSubmit = mode === 'url' ? !!url.trim() : !!pastedText.trim()

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }} onClick={onClose}>
      <div className="card animate-in" style={{ width: 520, padding: 24 }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Add job listing</h2>

        {/* Mode tabs */}
        <div style={{
          display: 'flex', gap: 2, background: 'var(--bg)',
          borderRadius: 8, padding: 3, marginBottom: 18,
          border: '1px solid var(--border)',
        }}>
          <button style={tabStyle(mode === 'url')} onClick={() => setMode('url')}>
            <Link size={13} /> Fetch from URL
          </button>
          <button style={tabStyle(mode === 'paste')} onClick={() => setMode('paste')}>
            <AlignLeft size={13} /> Paste text
          </button>
        </div>

        {mode === 'url' ? (
          <>
            <label className="label">Job posting URL</label>
            <input
              className="input"
              type="url"
              placeholder="https://jobs.lever.co/company/role-id"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
              Works best with Indeed, Greenhouse, Lever, and Workday.{' '}
              <button
                onClick={() => setMode('paste')}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}
              >
                LinkedIn blocking you? Use paste mode.
              </button>
            </p>
          </>
        ) : (
          <>
            <label className="label">Paste the full job description</label>
            <textarea
              className="input"
              style={{ minHeight: 220, fontFamily: 'DM Mono', fontSize: 12, lineHeight: 1.7 }}
              placeholder={`Paste the full job listing text here.\n\nFor LinkedIn:\n1. Open the job posting\n2. Select all text on the page (Cmd+A / Ctrl+A)\n3. Copy and paste it here\n\nClaude will extract the title, company, skills, and requirements automatically.`}
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              autoFocus
            />
            <div style={{ marginTop: 10 }}>
              <label className="label">Source URL <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional — for your reference)</span></label>
              <input
                className="input"
                type="url"
                placeholder="https://linkedin.com/jobs/view/..."
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
              />
            </div>
          </>
        )}

        {error && (
          <p style={{ fontSize: 12, color: 'var(--no)', marginTop: 10 }}>{error}</p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !canSubmit}>
            {loading
              ? <><span className="spinner" /> {mode === 'url' ? 'Fetching…' : 'Parsing…'}</>
              : mode === 'url' ? 'Fetch & add' : 'Parse & add'
            }
          </button>
        </div>
      </div>
    </div>
  )
}

function ListingCard({ listing, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [rating, setRating] = useState(listing.interest_rating)
  const [cluster, setCluster] = useState(listing.role_cluster || 'other')
  const [notes, setNotes] = useState(listing.notes || '')
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)

  async function save(updates) {
    setSaving(true)
    await supabase.from('job_listings').update(updates).eq('id', listing.id)
    setSaving(false)
    onUpdate()
  }

  async function markAsApplied() {
    setApplying(true)
    await supabase.from('job_listings').update({ application_status: 'applied' }).eq('id', listing.id)
    setApplying(false)
    onUpdate()
  }

  return (
    <div className="card animate-in" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Interest rating */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 2 }}>
          {RATINGS.map(r => (
            <button
              key={r}
              onClick={() => { setRating(r); save({ interest_rating: r }) }}
              title={r}
              style={{
                width: 8, height: 8, borderRadius: '50%',
                border: 'none', cursor: 'pointer', padding: 0,
                background: rating === r
                  ? r === 'yes' ? 'var(--yes)' : r === 'maybe' ? 'var(--maybe)' : 'var(--no)'
                  : 'var(--border-strong)',
                transition: 'background 0.12s',
              }}
            />
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{listing.title || 'Untitled role'}</span>
            {listing.company && (
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>at {listing.company}</span>
            )}
            {listing.location && (
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>· {listing.location}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span className={`badge badge-${rating}`}>{rating}</span>
            {listing.seniority_level && (
              <span className="badge badge-neutral">{listing.seniority_level}</span>
            )}
            <select
              value={cluster}
              onChange={e => { setCluster(e.target.value); save({ role_cluster: e.target.value }) }}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 4, padding: '1px 6px',
                fontSize: 11, fontFamily: 'DM Mono, monospace',
                background: 'white', color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              {CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Skills preview */}
          {listing.parsed_skills?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
              {listing.parsed_skills.slice(0, expanded ? 999 : 8).map(skill => (
                <span key={skill} className="skill-pill">{skill}</span>
              ))}
              {!expanded && listing.parsed_skills.length > 8 && (
                <span className="skill-pill" style={{ opacity: 0.5 }}>+{listing.parsed_skills.length - 8}</span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {(saving || applying) && <span className="spinner" />}
          {(rating === 'yes' || rating === 'maybe') && (
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: 11, gap: 4 }}
              onClick={markAsApplied}
              disabled={applying || saving}
              title="Move to Pipeline as Applied"
            >
              <Send size={11} />
              Applied
            </button>
          )}
          <a href={listing.url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: '5px 8px' }}>
            <ExternalLink size={13} />
          </a>
          <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button className="btn btn-ghost" style={{ padding: '5px 8px', color: 'var(--no)' }}
            onClick={() => onDelete(listing.id)}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {listing.parsed_requirements?.length > 0 && (
            <div>
              <p className="section-header" style={{ marginBottom: 8 }}>Requirements</p>
              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {listing.parsed_requirements.map((r, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {listing.parsed_nice_to_haves?.length > 0 && (
            <div>
              <p className="section-header" style={{ marginBottom: 8 }}>Nice to haves</p>
              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {listing.parsed_nice_to_haves.map((r, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input"
              style={{ minHeight: 72 }}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => save({ notes })}
              placeholder="Why does this role appeal to you? Any concerns?"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function ListingsPage() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('all')

  async function load() {
    const { data } = await supabase
      .from('job_listings')
      .select('*')
      .eq('is_archived', false)
      .is('application_status', null)
      .order('created_at', { ascending: false })
    setListings(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id) {
    if (!confirm('Remove this listing?')) return
    await supabase.from('job_listings').delete().eq('id', id)
    load()
  }

  const filtered = filter === 'all' ? listings : listings.filter(l => l.interest_rating === filter)

  const counts = {
    all: listings.length,
    yes: listings.filter(l => l.interest_rating === 'yes').length,
    maybe: listings.filter(l => l.interest_rating === 'maybe').length,
    no: listings.filter(l => l.interest_rating === 'no').length,
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Job Listings</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 2 }}>
            {listings.length} saved · signal your interest to train the gap analysis
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} /> Add listing
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {['all', 'yes', 'maybe', 'no'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="btn btn-ghost"
            style={{
              color: filter === f ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: filter === f ? 600 : 400,
              padding: '4px 10px',
            }}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            <span style={{
              marginLeft: 4, fontSize: 11, fontFamily: 'DM Mono',
              color: 'var(--text-tertiary)'
            }}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
          <span className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
          {listings.length === 0
            ? 'No listings yet. Add your first job posting to get started.'
            : `No ${filter} listings.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(l => (
            <ListingCard key={l.id} listing={l} onUpdate={load} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showModal && (
        <AddListingModal onClose={() => setShowModal(false)} onAdded={load} />
      )}
    </div>
  )
}
