import { useState, useEffect } from 'react'
import { ExternalLink, Archive, FileText, Users, Briefcase, RotateCcw, ArrowLeft, Scale } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import CoverLetterModal from '../components/CoverLetterModal.jsx'
import ContactsModal from '../components/ContactsModal.jsx'
import RelevantPiecesModal from '../components/RelevantPiecesModal.jsx'

const COLUMNS = [
  { status: 'applied',      label: 'Applied',      color: 'var(--text-primary)' },
  { status: 'screening',    label: 'Screening',    color: 'var(--maybe)' },
  { status: 'interviewing', label: 'Interviewing', color: 'var(--yes)' },
  { status: 'offer',        label: 'Offer',        color: '#7c3aed' },
  { status: 'closed',       label: 'Closed',       color: 'var(--text-tertiary)', muted: true },
]

const OFFER_ROWS = [
  { key: 'base_salary',   label: 'Base Salary', type: 'salary',  placeholder: '180000' },
  { key: 'equity',        label: 'Equity',                       placeholder: 'e.g. $200k RSUs / 4yr' },
  { key: 'bonus',         label: 'Bonus',                        placeholder: 'e.g. 15% target' },
  { key: 'remote_policy', label: 'Remote',                       placeholder: 'e.g. Hybrid 2d/wk' },
  { key: 'pto',           label: 'PTO',                          placeholder: 'e.g. Unlimited' },
  { key: 'benefits',      label: 'Benefits',     multiline: true, placeholder: 'Health, dental, 401k match…' },
  { key: 'score',         label: 'Overall',      type: 'stars' },
  { key: 'notes',         label: 'Notes',        multiline: true, placeholder: 'Gut feelings, concerns, questions…' },
]

// ─── Kanban ───────────────────────────────────────────────────────────────────

function KanbanCard({ listing, onDragStart, onArchive, onMoveBack, onCoverLetter, onContacts, onPortfolio }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, listing.id)}
      className="card"
      style={{ padding: '12px 14px', cursor: 'grab', userSelect: 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>
            {listing.title || 'Untitled role'}
          </p>
          {listing.company && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{listing.company}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '3px 6px', color: listing.contacts?.length ? 'var(--yes)' : 'var(--text-tertiary)', position: 'relative' }}
            onClick={() => onContacts(listing)}
            title="Contacts"
          >
            <Users size={11} />
            {listing.contacts?.length > 0 && (
              <span style={{
                position: 'absolute', top: 0, right: 0,
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--yes)', border: '1.5px solid white',
              }} />
            )}
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '3px 6px', color: 'var(--text-tertiary)' }}
            onClick={() => onPortfolio(listing)}
            title="Relevant portfolio"
          >
            <Briefcase size={11} />
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '3px 6px', color: listing.cover_letter ? 'var(--yes)' : 'var(--text-tertiary)' }}
            onClick={() => onCoverLetter(listing)}
            title={listing.cover_letter ? 'View / edit cover letter' : 'Generate cover letter'}
          >
            <FileText size={11} />
          </button>
          <a
            href={listing.url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
            style={{ padding: '3px 6px' }}
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={11} />
          </a>
          <button
            className="btn btn-ghost"
            style={{ padding: '3px 6px', color: 'var(--text-tertiary)' }}
            onClick={() => onMoveBack(listing.id)}
            title="Move back to research"
          >
            <RotateCcw size={11} />
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '3px 6px', color: 'var(--text-tertiary)' }}
            onClick={() => onArchive(listing.id)}
            title="Archive listing"
          >
            <Archive size={11} />
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className={`badge badge-${listing.interest_rating}`}>{listing.interest_rating}</span>
        {listing.seniority_level && (
          <span className="badge badge-neutral">{listing.seniority_level}</span>
        )}
        {listing.location && (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{listing.location}</span>
        )}
      </div>
      {listing.parsed_skills?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 8 }}>
          {listing.parsed_skills.slice(0, 5).map(skill => (
            <span key={skill} className="skill-pill" style={{ fontSize: 10, padding: '1px 5px' }}>{skill}</span>
          ))}
          {listing.parsed_skills.length > 5 && (
            <span className="skill-pill" style={{ fontSize: 10, padding: '1px 5px', opacity: 0.5 }}>
              +{listing.parsed_skills.length - 5}
            </span>
          )}
        </div>
      )}
      <p style={{ fontSize: 10, fontFamily: 'DM Mono', color: 'var(--text-tertiary)', marginTop: 8 }}>
        {listing.applied_at
          ? `Applied ${new Date(listing.applied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : `Saved ${new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        }
      </p>
    </div>
  )
}

function KanbanColumn({ col, listings, onDragStart, onDrop, onArchive, onMoveBack, onCoverLetter, onContacts, onPortfolio }) {
  const [isDragOver, setIsDragOver] = useState(false)

  return (
    <div
      style={{
        flex: '0 0 210px',
        display: 'flex',
        flexDirection: 'column',
        opacity: col.muted ? 0.65 : 1,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingBottom: 8,
        borderBottom: `2px solid ${col.color}`,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: col.color,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          {col.label}
        </span>
        <span style={{ fontSize: 11, fontFamily: 'DM Mono', color: 'var(--text-tertiary)' }}>
          {listings.length}
        </span>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false)
        }}
        onDrop={(e) => { e.preventDefault(); setIsDragOver(false); onDrop(e, col.status) }}
        style={{
          flex: 1,
          minHeight: 160,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          borderRadius: 8,
          padding: isDragOver ? 8 : 0,
          background: isDragOver ? 'var(--bg)' : 'transparent',
          border: isDragOver ? '2px dashed var(--border-strong)' : '2px solid transparent',
          transition: 'all 0.1s',
        }}
      >
        {listings.map(l => (
          <KanbanCard
            key={l.id}
            listing={l}
            onDragStart={onDragStart}
            onArchive={onArchive}
            onMoveBack={onMoveBack}
            onCoverLetter={onCoverLetter}
            onContacts={onContacts}
            onPortfolio={onPortfolio}
          />
        ))}
        {listings.length === 0 && !isDragOver && (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', padding: '12px 0' }}>
            Drop here
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Offer Comparison ─────────────────────────────────────────────────────────

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(null)
  return (
    <div style={{ display: 'flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n === value ? null : n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 2px',
            fontSize: 18,
            lineHeight: 1,
            color: n <= (hover ?? value ?? 0) ? '#f59e0b' : 'var(--border)',
            transition: 'color 0.1s',
          }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function OfferCell({ value, onSave, placeholder, multiline, type }) {
  function fmt(v) {
    if (v == null || v === '') return ''
    if (type === 'salary') return Number(v).toLocaleString()
    return String(v)
  }

  const [local, setLocal] = useState(fmt(value))

  useEffect(() => { setLocal(fmt(value)) }, [value, type])

  function handleBlur() {
    let parsed
    if (type === 'salary') {
      const n = parseInt(local.replace(/[^0-9]/g, ''), 10)
      parsed = isNaN(n) ? null : n
    } else {
      parsed = local.trim() || null
    }
    if (parsed !== value) onSave(parsed)
  }

  const shared = {
    className: 'input',
    value: local,
    onChange: e => setLocal(e.target.value),
    onBlur: handleBlur,
    placeholder,
    style: { width: '100%', fontSize: 13 },
  }

  return multiline
    ? <textarea {...shared} style={{ ...shared.style, minHeight: 72, resize: 'vertical' }} />
    : <input {...shared} />
}

function OffersView({ offerListings, offerDetails, onSaveField, onBack }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <button
          className="btn btn-ghost"
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px' }}
        >
          <ArrowLeft size={13} /> Pipeline
        </button>
        <span style={{ color: 'var(--border)' }}>·</span>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Compare Offers</h2>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 130 }} />
            {offerListings.map(l => <col key={l.id} style={{ minWidth: 220 }} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding: '10px 14px', borderBottom: '2px solid var(--border)' }} />
              {offerListings.map(l => (
                <th
                  key={l.id}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    borderBottom: '2px solid #7c3aed',
                    verticalAlign: 'bottom',
                  }}
                >
                  <p style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{l.title || 'Untitled role'}</p>
                  {l.company && (
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>{l.company}</p>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {OFFER_ROWS.map((row, i) => (
              <tr
                key={row.key}
                style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}
              >
                <td style={{
                  padding: '12px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  verticalAlign: 'top',
                  whiteSpace: 'nowrap',
                  borderRight: '1px solid var(--border)',
                }}>
                  {row.label}
                </td>
                {offerListings.map(l => {
                  const details = offerDetails[l.id] || {}
                  const val = details[row.key] ?? null
                  return (
                    <td key={l.id} style={{ padding: '10px 16px', verticalAlign: 'top' }}>
                      {row.type === 'stars' ? (
                        <StarRating value={val} onChange={v => onSaveField(l.id, row.key, v)} />
                      ) : (
                        <OfferCell
                          value={val}
                          onSave={v => onSaveField(l.id, row.key, v)}
                          placeholder={row.placeholder}
                          multiline={row.multiline}
                          type={row.type}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [listings, setListings] = useState([])
  const [offerDetails, setOfferDetails] = useState({})
  const [view, setView] = useState('kanban')
  const [loading, setLoading] = useState(true)
  const [draggingId, setDraggingId] = useState(null)
  const [coverLetterListing, setCoverLetterListing] = useState(null)
  const [contactsListing, setContactsListing] = useState(null)
  const [portfolioListing, setPortfolioListing] = useState(null)

  async function load() {
    const [{ data: listingsData }, { data: detailsData }] = await Promise.all([
      supabase
        .from('job_listings')
        .select('*')
        .eq('is_archived', false)
        .not('application_status', 'is', null)
        .order('created_at', { ascending: false }),
      supabase.from('offer_details').select('*'),
    ])
    setListings(listingsData || [])
    const map = {}
    for (const d of detailsData || []) map[d.listing_id] = d
    setOfferDetails(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Auto-reset to kanban if offers drop below 2
  useEffect(() => {
    if (view === 'offers' && byStatus('offer').length < 2) setView('kanban')
  }, [listings])

  function handleDragStart(e, id) {
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  async function handleDrop(e, status) {
    if (!draggingId) return
    await supabase.from('job_listings').update({ application_status: status }).eq('id', draggingId)
    setDraggingId(null)
    load()
  }

  async function handleArchive(id) {
    if (!confirm('Archive this listing?')) return
    await supabase.from('job_listings').update({ is_archived: true }).eq('id', id)
    load()
  }

  async function handleMoveBack(id) {
    await supabase.from('job_listings').update({ application_status: null, applied_at: null }).eq('id', id)
    load()
  }

  async function saveOfferField(listingId, field, value) {
    const existing = offerDetails[listingId]
    if (existing?.id) {
      await supabase
        .from('offer_details')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      setOfferDetails(prev => ({ ...prev, [listingId]: { ...prev[listingId], [field]: value } }))
    } else {
      const { data } = await supabase
        .from('offer_details')
        .insert({ listing_id: listingId, [field]: value })
        .select()
        .single()
      if (data) setOfferDetails(prev => ({ ...prev, [listingId]: data }))
    }
  }

  const byStatus = (status) => listings.filter(l => l.application_status === status)
  const active = listings.filter(l => l.application_status !== 'closed').length
  const offerListings = byStatus('offer')
  const canCompare = offerListings.length >= 2

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Pipeline</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 2 }}>
            {active} active application{active !== 1 ? 's' : ''} · drag cards between columns to update status
          </p>
        </div>
        {canCompare && view === 'kanban' && (
          <button
            className="btn btn-secondary"
            onClick={() => setView('offers')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Scale size={13} />
            Compare Offers ({offerListings.length})
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
          <span className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : view === 'offers' ? (
        <OffersView
          offerListings={offerListings}
          offerDetails={offerDetails}
          onSaveField={saveOfferField}
          onBack={() => setView('kanban')}
        />
      ) : listings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
          No applications yet. Mark a listing as "Applied" from the Listings page to get started.
        </div>
      ) : (
        <div style={{
          display: 'flex',
          gap: 16,
          overflowX: 'auto',
          paddingBottom: 20,
          alignItems: 'flex-start',
        }}>
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.status}
              col={col}
              listings={byStatus(col.status)}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onArchive={handleArchive}
              onMoveBack={handleMoveBack}
              onCoverLetter={setCoverLetterListing}
              onContacts={setContactsListing}
              onPortfolio={setPortfolioListing}
            />
          ))}
        </div>
      )}

      {coverLetterListing && (
        <CoverLetterModal
          listing={coverLetterListing}
          onClose={() => setCoverLetterListing(null)}
          onSaved={(savedText) => {
            setListings(prev => prev.map(l =>
              l.id === coverLetterListing.id ? { ...l, cover_letter: savedText } : l
            ))
            setCoverLetterListing(null)
          }}
        />
      )}

      {contactsListing && (
        <ContactsModal
          listing={contactsListing}
          onClose={() => {
            load()
            setContactsListing(null)
          }}
        />
      )}

      {portfolioListing && (
        <RelevantPiecesModal
          listing={portfolioListing}
          onClose={() => setPortfolioListing(null)}
        />
      )}
    </div>
  )
}
