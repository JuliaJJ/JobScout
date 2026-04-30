import { useState, useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { Link } from 'react-router-dom'

const CLUSTER_COLORS = {
  'ux': '#dbeafe',
  'product-design': '#fce7f3',
  'design-engineer': '#dcfce7',
  'design-technologist': '#fef9c3',
}

export default function RelevantPiecesModal({ listing, onClose }) {
  const [pieces, setPieces] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('portfolio_pieces')
        .select('*')
        .order('created_at', { ascending: false })
      const cluster = listing.role_cluster
      // Only show pieces explicitly tagged to the listing's cluster.
      // If the listing has no cluster assigned, show everything.
      const relevant = (data || []).filter(p =>
        !cluster || p.role_clusters?.includes(cluster)
      )
      setPieces(relevant)
      setLoading(false)
    }
    load()
  }, [listing.role_cluster])

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        className="card animate-in"
        style={{ width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Relevant portfolio</h2>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {listing.title}{listing.company ? ` · ${listing.company}` : ''}
              {listing.role_cluster && (
                <span style={{ marginLeft: 6, padding: '1px 7px', borderRadius: 20, fontSize: 10, fontFamily: 'DM Mono', background: CLUSTER_COLORS[listing.role_cluster] || 'var(--bg)', border: '1px solid var(--border)' }}>
                  {listing.role_cluster}
                </span>
              )}
            </p>
          </div>
          <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <span className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : pieces.length === 0 ? (
            <div style={{ padding: '24px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No portfolio pieces tagged to this cluster.{' '}
              <Link to="/portfolio" onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
                Add some on the Portfolio page.
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pieces.map(p => (
                <div key={p.id} style={{ padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</span>
                        <span className="badge badge-neutral">{p.type}</span>
                      </div>
                      {p.description && (
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 5, lineHeight: 1.5 }}>
                          {p.description}
                        </p>
                      )}
                      {p.skills?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 8 }}>
                          {p.skills.slice(0, 6).map(s => (
                            <span key={s} className="skill-pill" style={{ fontSize: 10, padding: '1px 5px' }}>{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: '4px 7px', flexShrink: 0 }}>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
