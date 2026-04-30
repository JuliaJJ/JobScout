import { useState, useEffect } from 'react'
import { Plus, Trash2, Mail, Linkedin, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

const ROLES = ['Recruiter', 'Hiring Manager', 'Interviewer', 'Other']

const today = new Date().toISOString().split('T')[0]

function blankForm() {
  return { name: '', role: 'Recruiter', email: '', linkedin: '', date: today, notes: '' }
}

function ContactRow({ contact, onDelete }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 12, padding: '10px 12px', background: 'var(--bg)',
      border: '1px solid var(--border)', borderRadius: 6,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{contact.name}</span>
          <span className="badge badge-neutral" style={{ fontSize: 10 }}>{contact.role}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 5 }}>
          {contact.date && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'DM Mono' }}>
              <Calendar size={10} />
              {new Date(contact.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', textDecoration: 'none' }}
            >
              <Mail size={10} /> {contact.email}
            </a>
          )}
          {contact.linkedin && (
            <a
              href={contact.linkedin}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', textDecoration: 'none' }}
            >
              <Linkedin size={10} /> LinkedIn
            </a>
          )}
        </div>
        {contact.notes && (
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5 }}>
            {contact.notes}
          </p>
        )}
      </div>
      <button
        className="btn btn-ghost"
        style={{ padding: '3px 6px', color: 'var(--text-tertiary)', flexShrink: 0 }}
        onClick={() => onDelete(contact.id)}
        title="Remove contact"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

export default function ContactsSection({ listing }) {
  const [contacts, setContacts] = useState(listing.contacts || [])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)

  // Re-sync when parent reloads with fresh data (card stays expanded after onUpdate)
  useEffect(() => {
    setContacts(listing.contacts || [])
  }, [JSON.stringify(listing.contacts)])

  async function persist(updated) {
    setSaving(true)
    await supabase.from('job_listings').update({ contacts: updated }).eq('id', listing.id)
    setSaving(false)
    setContacts(updated)
  }

  async function addContact() {
    if (!form.name.trim()) return
    const contact = { ...form, id: crypto.randomUUID() }
    await persist([...contacts, contact])
    setAdding(false)
    setForm(blankForm)
  }

  async function deleteContact(id) {
    if (!confirm('Remove this contact?')) return
    await persist(contacts.filter(c => c.id !== id))
  }

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm(f => ({ ...f, [key]: e.target.value })),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {contacts.map(c => (
        <ContactRow key={c.id} contact={c} onDelete={deleteContact} />
      ))}

      {adding ? (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 6,
          padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10 }}>
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="Sarah Chen" autoFocus {...field('name')}
                onKeyDown={e => e.key === 'Enter' && addContact()} />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" {...field('role')}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: 10 }}>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="sarah@company.com" {...field('email')} />
            </div>
            <div>
              <label className="label">LinkedIn URL</label>
              <input className="input" type="url" placeholder="https://linkedin.com/in/…" {...field('linkedin')} />
            </div>
            <div>
              <label className="label">Date contacted</label>
              <input className="input" type="date" {...field('date')} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input"
              style={{ minHeight: 60 }}
              placeholder="Follow up in 1 week, phone screen scheduled…"
              {...field('notes')}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => { setAdding(false); setForm(blankForm) }}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={addContact}
              disabled={saving || !form.name.trim()}
            >
              {saving ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Saving…</> : 'Add contact'}
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-secondary"
          style={{ alignSelf: 'flex-start', gap: 5, fontSize: 12 }}
          onClick={() => setAdding(true)}
        >
          <Plus size={12} /> Add contact
        </button>
      )}
    </div>
  )
}
