import { X } from 'lucide-react'
import ContactsSection from './ContactsSection.jsx'

export default function ContactsModal({ listing, onClose }) {
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
        style={{ width: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Contacts</h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {listing.title}{listing.company ? ` · ${listing.company}` : ''}
            </p>
          </div>
          <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div style={{ overflowY: 'auto' }}>
          <ContactsSection listing={listing} />
        </div>
      </div>
    </div>
  )
}
