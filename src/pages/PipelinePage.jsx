import { useState, useEffect } from 'react'
import { ExternalLink, Archive, FileText, Users, Briefcase } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import CoverLetterModal from '../components/CoverLetterModal.jsx'
import ContactsModal from '../components/ContactsModal.jsx'
import RelevantPiecesModal from '../components/RelevantPiecesModal.jsx'

const COLUMNS = [
  { status: 'applied', label: 'Applied', color: 'var(--text-primary)' },
  { status: 'screening', label: 'Screening', color: 'var(--maybe)' },
  { status: 'interviewing', label: 'Interviewing', color: 'var(--yes)' },
  { status: 'offer', label: 'Offer', color: '#7c3aed' },
  { status: 'closed', label: 'Closed', color: 'var(--text-tertiary)', muted: true },
]

function KanbanCard({ listing, onDragStart, onArchive, onCoverLetter, onContacts, onPortfolio }) {
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
    </div>
  )
}

function KanbanColumn({ col, listings, onDragStart, onDrop, onArchive, onCoverLetter, onContacts, onPortfolio }) {
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

export default function PipelinePage() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [draggingId, setDraggingId] = useState(null)
  const [coverLetterListing, setCoverLetterListing] = useState(null)
  const [contactsListing, setContactsListing] = useState(null)
  const [portfolioListing, setPortfolioListing] = useState(null)

  async function load() {
    const { data } = await supabase
      .from('job_listings')
      .select('*')
      .eq('is_archived', false)
      .not('application_status', 'is', null)
      .order('created_at', { ascending: false })
    setListings(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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

  const byStatus = (status) => listings.filter(l => l.application_status === status)
  const active = listings.filter(l => l.application_status !== 'closed').length

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Pipeline</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 2 }}>
          {active} active application{active !== 1 ? 's' : ''} · drag cards between columns to update status
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
          <span className="spinner" style={{ margin: '0 auto' }} />
        </div>
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
