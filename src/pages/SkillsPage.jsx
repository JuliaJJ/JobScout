import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

function SkillBar({ skill, count, max, pct }) {
  const intensity = count / max
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
      <span style={{
        fontFamily: 'DM Mono', fontSize: 12,
        color: 'var(--text-primary)', minWidth: 180, flexShrink: 0
      }}>{skill}</span>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${(count / max) * 100}%`,
          height: '100%',
          background: intensity > 0.6 ? 'var(--accent)' : intensity > 0.3 ? '#525252' : '#d4d4d4',
          borderRadius: 3,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-tertiary)', minWidth: 48, textAlign: 'right' }}>
        {count}× · {pct}%
      </span>
    </div>
  )
}

export default function SkillsPage() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [clusterFilter, setClusterFilter] = useState('all')
  const [ratingFilter, setRatingFilter] = useState('wanted') // wanted = yes + maybe

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('job_listings')
        .select('parsed_skills, role_cluster, interest_rating')
        .eq('is_archived', false)
      setListings(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = listings.filter(l => {
    const ratingOk = ratingFilter === 'all' || (ratingFilter === 'wanted' ? l.interest_rating !== 'no' : l.interest_rating === ratingFilter)
    const clusterOk = clusterFilter === 'all' || l.role_cluster === clusterFilter
    return ratingOk && clusterOk
  })

  // Aggregate skills
  const skillCounts = {}
  filtered.forEach(l => {
    (l.parsed_skills || []).forEach(s => {
      skillCounts[s] = (skillCounts[s] || 0) + 1
    })
  })

  const sorted = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
  const max = sorted[0]?.[1] || 1
  const total = filtered.length

  const clusters = ['all', ...new Set(listings.map(l => l.role_cluster).filter(Boolean))]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Skills Intelligence</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 2 }}>
          Aggregated from {filtered.length} listings · sorted by frequency
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <p className="label">Interest filter</p>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['wanted', 'Yes + Maybe'], ['yes', 'Yes only'], ['all', 'All']].map(([v, l]) => (
              <button key={v} onClick={() => setRatingFilter(v)}
                className="btn btn-secondary"
                style={{ fontWeight: ratingFilter === v ? 600 : 400, fontSize: 12 }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="label">Role cluster</p>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {clusters.map(c => (
              <button key={c} onClick={() => setClusterFilter(c)}
                className="btn btn-secondary"
                style={{ fontWeight: clusterFilter === c ? 600 : 400, fontSize: 12 }}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64 }}><span className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
          No skills data yet. Add some listings first.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {/* Top skills */}
          <div className="card" style={{ padding: 20 }}>
            <p className="section-header" style={{ marginBottom: 16 }}>Most requested skills</p>
            {sorted.slice(0, 30).map(([skill, count]) => (
              <SkillBar key={skill} skill={skill} count={count} max={max}
                pct={total ? Math.round(count / total * 100) : 0} />
            ))}
          </div>

          {/* Skill clouds by tier */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Core (>60% of roles)', min: 0.6 },
              { label: 'Common (30–60%)', min: 0.3, max: 0.6 },
              { label: 'Emerging (<30%)', max: 0.3 },
            ].map(({ label, min = 0, max: mx = 1 }) => {
              const tier = sorted.filter(([, c]) => {
                const pct = c / (total || 1)
                return pct >= min && pct < mx
              })
              return (
                <div key={label} className="card" style={{ padding: 16 }}>
                  <p className="section-header" style={{ marginBottom: 12 }}>{label}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {tier.map(([skill, count]) => (
                      <span key={skill} className={`skill-pill ${
                        count / (total || 1) > 0.6 ? 'skill-pill-high' :
                        count / (total || 1) > 0.3 ? 'skill-pill-med' : 'skill-pill-low'
                      }`}>
                        {skill}
                        <span style={{ opacity: 0.5, fontSize: 10 }}>{count}</span>
                      </span>
                    ))}
                    {tier.length === 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>None yet</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
