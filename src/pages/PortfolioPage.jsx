import { useState, useEffect, useRef } from 'react'
import { Plus, ExternalLink, Pencil, Trash2, X, FileText, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

function parseMdxFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return { meta: {}, body: text.trim() }

  const lines = match[1].split('\n')
  const meta = {}
  let key = null
  let mode = null // 'block' | 'list'
  let acc = []

  function commit() {
    if (!key) return
    if (mode === 'block') meta[key] = acc.join(' ').replace(/\s+/g, ' ').trim()
    else if (mode === 'list') meta[key] = acc
    key = null; mode = null; acc = []
  }

  for (const line of lines) {
    if (/^\w[\w_]*\s*:/.test(line)) {
      commit()
      const colon = line.indexOf(':')
      key = line.slice(0, colon).trim()
      const val = line.slice(colon + 1).trim()
      if (val === '>-' || val === '>' || val === '|-' || val === '|') {
        mode = 'block'; acc = []
      } else if (val === '') {
        mode = 'list'; acc = []
      } else {
        meta[key] = val; key = null; acc = []
      }
    } else if (mode === 'block' && /^\s+\S/.test(line)) {
      acc.push(line.trim())
    } else if (mode === 'list' && /^\s+-\s+/.test(line)) {
      const item = line.replace(/^\s+-\s+/, '')
      if (!item.includes(':')) acc.push(item) // skip complex object items
    }
  }
  commit()

  return { meta, body: text.slice(match[0].length).trim() }
}

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
  const [mdxContent, setMdxContent] = useState(null)
  const [mdxFilename, setMdxFilename] = useState('')
  const fileInputRef = useRef(null)

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
      if (piece.mdx_content) setMdxContent(piece.mdx_content)
    }
  }, [piece])

  async function handleMdxFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const { meta } = parseMdxFrontmatter(text)
    setMdxContent(text)
    setMdxFilename(file.name)

    const skillsStr = Array.isArray(meta.skills)
      ? meta.skills.join(', ')
      : (meta.skills || '')

    const clustersRaw = Array.isArray(meta.role_clusters)
      ? meta.role_clusters
      : (meta.role_clusters || '').split(',').map(s => s.trim())

    setForm(f => ({
      ...f,
      title: f.title || meta.title || '',
      description: f.description || meta.summary || meta.description || '',
      skillsRaw: f.skillsRaw || skillsStr,
      role_clusters: f.role_clusters.length
        ? f.role_clusters
        : clustersRaw.filter(c => CLUSTERS.includes(c)),
    }))
  }

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
      mdx_content: mdxContent ?? (piece?.mdx_content || null),
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

          <div>
            <label className="label">Case study file <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(.mdx)</span></label>
            <input ref={fileInputRef} type="file" accept=".mdx" style={{ display: 'none' }} onChange={handleMdxFile} />
            {mdxContent ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13 }}>
                <FileText size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mdxFilename || 'Case study attached'}
                </span>
                <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => fileInputRef.current?.click()}>
                  Replace
                </button>
                <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 11, color: 'var(--no)' }} onClick={() => { setMdxContent(null); setMdxFilename('') }}>
                  Remove
                </button>
              </div>
            ) : (
              <button
                className="btn btn-secondary"
                style={{ width: '100%', gap: 6, justifyContent: 'center', padding: '9px 12px', borderStyle: 'dashed' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={13} />
                Upload .mdx file
              </button>
            )}
            {mdxContent && (
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>
                Reads frontmatter: title, summary/description, skills (list or comma-separated), role_clusters.
              </p>
            )}
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

function CaseStudyViewer({ piece, onClose }) {
  const { body } = parseMdxFrontmatter(piece.mdx_content || '')
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        className="card animate-in"
        style={{ width: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={14} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{piece.title}</span>
            <span className="badge badge-neutral">case study</span>
          </div>
          <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
          <pre style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-primary)', margin: 0 }}>
            {body}
          </pre>
        </div>
      </div>
    </div>
  )
}

function PieceCard({ piece, onEdit, onDelete }) {
  const [showCaseStudy, setShowCaseStudy] = useState(false)
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
          {piece.mdx_content && (
            <button className="btn btn-ghost" style={{ padding: '5px 7px', color: 'var(--text-secondary)' }} title="View case study" onClick={() => setShowCaseStudy(true)}>
              <FileText size={12} />
            </button>
          )}
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

      {piece.mdx_content && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingTop: 2 }}>
          <FileText size={11} style={{ color: 'var(--text-tertiary)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'DM Mono' }}>case study attached</span>
        </div>
      )}

      {showCaseStudy && <CaseStudyViewer piece={piece} onClose={() => setShowCaseStudy(false)} />}
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
