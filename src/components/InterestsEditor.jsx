import { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

export default function InterestsEditor({ onChange }) {
  const [interests, setInterests] = useState([])
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data, error: err } = await supabase.from('interests').select('*').order('created_at', { ascending: true })
    if (err) { setError(err.message); return }
    setInterests(data || [])
    onChange?.(data || [])
  }

  useEffect(() => { load() }, [])

  async function addInterest() {
    if (!label.trim()) return
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('interests').insert({ label: label.trim(), notes: notes.trim() || null })
    setSaving(false)
    if (err) { setError(err.message); return }
    setLabel('')
    setNotes('')
    setAdding(false)
    load()
  }

  async function deleteInterest(id) {
    setError('')
    const { error: err } = await supabase.from('interests').delete().eq('id', id)
    if (err) { setError(err.message); return }
    load()
  }

  return (
    <div>
      <label className="label" style={{ marginBottom: 6 }}>
        Interests &amp; hobbies <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional — helps personalize project ideas)</span>
      </label>
      {error && (
        <p style={{ fontSize: 12, color: 'var(--no)', marginBottom: 8 }}>{error}</p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {interests.map(i => (
          <span
            key={i.id}
            className="skill-pill"
            title={i.notes || undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
          >
            {i.label}
            <X
              size={10}
              style={{ cursor: 'pointer', opacity: 0.6 }}
              onClick={() => deleteInterest(i.id)}
            />
          </span>
        ))}

        {adding ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              className="input"
              style={{ width: 140, padding: '4px 8px', fontSize: 12 }}
              placeholder="e.g. rock climbing"
              value={label}
              onChange={e => setLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addInterest()}
              autoFocus
            />
            <input
              className="input"
              style={{ width: 180, padding: '4px 8px', fontSize: 12 }}
              placeholder="notes (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addInterest()}
            />
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => { setAdding(false); setLabel(''); setNotes('') }}>
              Cancel
            </button>
            <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={addInterest} disabled={saving || !label.trim()}>
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        ) : (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: '3px 8px', gap: 4, color: 'var(--text-tertiary)' }}
            onClick={() => setAdding(true)}
          >
            <Plus size={11} /> Add interest
          </button>
        )}
      </div>
    </div>
  )
}
