import { useState, useEffect } from 'react'
import { Plus, ExternalLink, Pencil, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

const CLUSTERS = ['ux', 'product-design', 'design-engineer', 'design-technologist']
const TYPES = ['Case Study', 'Project', 'Prototype', 'Research', 'Side Project', 'Other']

const CLUSTER_COLORS = {
  'ux': '#dbeafe',
  'product-design': '#fce7f3',
  'design-engineer': '#dcfce7',
  'design-technologist': '#fef9c3',
}

function blankForm() {
  return { title: '', type: 'Case Study', description: '', url: '', role_clusters: [], skillsRaw: '' }
}

function PieceModal({ piece, onClose, onSaved }) {
  const [form, setForm] = useState(blankForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (piece) {
      setForm({
        title: piece.title || '',
        type: piece.type || 'Case Study',
        description: piece.description || '',
        url: piece.url || '',
        role_clusters: piece.role_clusters || [],
        skillsRaw: (piece.skills || []).join(', '),
      })
    }
  }, [piece])

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function toggleCluster(c) {
    setForm(f => ({
      ...f,
      role_clusters: f.role_clusters.includes(c)
        ? f.role_clusters.filter(x => x !== c)
        : [...f.role_clusters, c],
    }))
  }

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      type: form.type,
      description: form.description.trim() || null,
      url: form.url.trim() || null,
      role_clusters: form.role_clusters,
      skills: form.skillsRaw.split(',').map(s => s.trim()).filter(Boolean),
    }
    if (piece?.id) {
      await supabase.from('portfolio_pieces').update(payload).eq('id', piece.id)
    } else {
      await supabase.from('portfolio_pieces').insert(payload)
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  const isEditing = !!piece?.id

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        className="card animate-in"
        style={{ width: 580, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>{isEditing ? 'Edit portfolio piece' : 'Add portfolio piece'}</h2>
          <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
            <div>
              <label className="label">Title</label>
              <input className="input" placeholder="Redesign of checkout flow" autoFocus value={form.title}
                onChange={e => set('title', e.target.value)} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">URL <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
            <input className="input" type="url" placeholder="https://figma.com/… or portfolio link" value={form.url}
              onChange={e => set('url', e.target.value)} />
          </div>

          <div>
            <label className="label">Description <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
            <textarea className="input" style={{ minHeight: 80, lineHeight: 1.6 }}
              placeholder="Context, your role, the outcome…"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div>
            <label className="label">Relevant role clusters</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {CLUSTERS.map(c => {
                const active = form.role_clusters.includes(c)
                return (
                  <button
                    key={c}
                    onClick={() => toggleCluster(c)}
                    style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontFamily: 'DM Mono',
                      border: active ? '1.5px solid currentColor' : '1px solid var(--border)',
                      background: active ? CLUSTER_COLORS[c] : 'white',
                      cursor: 'pointer', fontWeight: active ? 600 : 400,
                      color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      transition: 'all 0.12s',
                    }}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">Skills demonstrated <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(comma-separated)</span></label>
            <input className="input" placeholder="Figma, user research, React, prototyping…"
              value={form.skillsRaw} onChange={e => set('skillsRaw', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.title.trim()}>
            {saving ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Saving…</> : isEditing ? 'Save changes' : 'Add piece'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PieceCard({ piece, onEdit, onDelete }) {
  return (
    <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{piece.title}</span>
            <span className="badge badge-neutral">{piece.type}</span>
          </div>
          {piece.description && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {piece.description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {piece.url && (
            <a href={piece.url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: '5px 7px' }}>
              <ExternalLink size={12} />
            </a>
          )}
          <button className="btn btn-ghost" style={{ padding: '5px 7px' }} onClick={() => onEdit(piece)}>
            <Pencil size={12} />
          </button>
          <button className="btn btn-ghost" style={{ padding: '5px 7px', color: 'var(--no)' }} onClick={() => onDelete(piece.id)}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {piece.role_clusters?.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {piece.role_clusters.map(c => (
            <span key={c} style={{
              fontSize: 11, fontFamily: 'DM Mono', padding: '2px 7px', borderRadius: 20,
              background: CLUSTER_COLORS[c] || 'var(--bg)', border: '1px solid var(--border)',
            }}>{c}</span>
          ))}
        </div>
      )}

      {piece.skills?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {piece.skills.slice(0, 8).map(s => (
            <span key={s} className="skill-pill">{s}</span>
          ))}
          {piece.skills.length > 8 && (
            <span className="skill-pill" style={{ opacity: 0.5 }}>+{piece.skills.length - 8}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default function PortfolioPage() {
  const [pieces, setPieces] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalPiece, setModalPiece] = useState(null) // null = closed, {} = new, {...} = editing

  async function load() {
    const { data } = await supabase.from('portfolio_pieces').select('*').order('created_at', { ascending: false })
    setPieces(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id) {
    if (!confirm('Remove this portfolio piece?')) return
    await supabase.from('portfolio_pieces').delete().eq('id', id)
    load()
  }

  const byCluster = (cluster) => pieces.filter(p => (p.role_clusters || []).includes(cluster))
  const untagged = pieces.filter(p => !p.role_clusters?.length)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Portfolio</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 2 }}>
            {pieces.length} piece{pieces.length !== 1 ? 's' : ''} · tag to role clusters for interview prep
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalPiece({})}>
          <Plus size={14} /> Add piece
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
          <span className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : pieces.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
          No portfolio pieces yet. Add a case study or project to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {CLUSTERS.filter(c => byCluster(c).length > 0).map(c => (
            <div key={c}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{
                  fontSize: 11, fontFamily: 'DM Mono', fontWeight: 700,
                  padding: '3px 9px', borderRadius: 20,
                  background: CLUSTER_COLORS[c], border: '1px solid var(--border)',
                  letterSpacing: '0.04em',
                }}>{c}</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'DM Mono' }}>
                  {byCluster(c).length}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {byCluster(c).map(p => (
                  <PieceCard key={p.id} piece={p} onEdit={setModalPiece} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          ))}

          {untagged.length > 0 && (
            <div>
              <p className="section-header" style={{ marginBottom: 10 }}>Untagged</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {untagged.map(p => (
                  <PieceCard key={p.id} piece={p} onEdit={setModalPiece} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {modalPiece !== null && (
        <PieceModal
          piece={modalPiece?.id ? modalPiece : null}
          onClose={() => setModalPiece(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
