import { useState, useEffect } from 'react'
import { Layers, Send, Users, Award } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // shift to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getLast10Weeks() {
  const weeks = []
  const thisMonday = getWeekStart(new Date())
  for (let i = 9; i >= 0; i--) {
    const w = new Date(thisMonday)
    w.setDate(w.getDate() - i * 7)
    weeks.push(w)
  }
  return weeks
}

function EventRow({ event }) {
  const { type, date, listing, contact } = event
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const config = {
    saved: {
      Icon: Layers,
      color: 'var(--text-tertiary)',
      label: `Saved ${listing.title || 'Untitled role'}${listing.company ? ` at ${listing.company}` : ''}`,
    },
    applied: {
      Icon: Send,
      color: 'var(--yes)',
      label: `Applied to ${listing.title || 'Untitled role'}${listing.company ? ` at ${listing.company}` : ''}`,
    },
    contact: {
      Icon: Users,
      color: 'var(--maybe)',
      label: `${contact.role}: ${contact.name}${listing.company ? ` · ${listing.company}` : ''}`,
    },
  }[type]

  if (!config) return null
  const { Icon, color, label } = config

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '10px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'var(--bg)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
      }}>
        <Icon size={12} color={color} />
      </div>
      <p style={{ flex: 1, fontSize: 13, lineHeight: 1.4, margin: 0, paddingTop: 6 }}>{label}</p>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'DM Mono', flexShrink: 0, paddingTop: 6 }}>
        {dateStr}
      </span>
    </div>
  )
}

export default function ActivityPage() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('job_listings')
        .select('id, title, company, created_at, applied_at, application_status, contacts')
        .order('created_at', { ascending: false })
      setListings(data || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
        <span className="spinner" style={{ margin: '0 auto' }} />
      </div>
    )
  }

  // Summary stats
  const appliedCount = listings.filter(l => l.application_status).length
  const active = listings.filter(l => l.application_status && l.application_status !== 'closed').length
  const offers = listings.filter(l => l.application_status === 'offer').length

  // Build full event list
  const events = []
  listings.forEach(l => {
    events.push({ type: 'saved', date: new Date(l.created_at), listing: l })
    if (l.applied_at) {
      events.push({ type: 'applied', date: new Date(l.applied_at), listing: l })
    }
    ;(l.contacts || []).forEach(c => {
      if (c.date) {
        events.push({ type: 'contact', date: new Date(c.date + 'T12:00:00'), contact: c, listing: l })
      }
    })
  })
  events.sort((a, b) => b.date - a.date)

  // Last 30-day counts
  const cutoff30 = new Date()
  cutoff30.setDate(cutoff30.getDate() - 30)
  const recentSaved = events.filter(e => e.type === 'saved' && e.date >= cutoff30).length
  const recentApplied = events.filter(e => e.type === 'applied' && e.date >= cutoff30).length

  // Weekly chart
  const weeks = getLast10Weeks()
  const weekData = weeks.map(weekStart => {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const inRange = e => e.date >= weekStart && e.date < weekEnd
    return {
      weekStart,
      label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      saved: events.filter(e => e.type === 'saved' && inRange(e)).length,
      applied: events.filter(e => e.type === 'applied' && inRange(e)).length,
    }
  })
  const maxBarVal = Math.max(1, ...weekData.flatMap(w => [w.saved, w.applied]))

  const barHeight = (n) => n > 0 ? Math.max((n / maxBarVal) * 72, 4) : 2

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Activity</h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 2 }}>
          {recentSaved} saved · {recentApplied} applied in the last 30 days
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Total saved', value: listings.length, Icon: Layers },
          { label: 'Applications sent', value: appliedCount, Icon: Send },
          { label: 'Active in pipeline', value: active, Icon: Users },
          { label: 'Offers', value: offers, Icon: Award },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon size={12} color="var(--text-tertiary)" />
              <span className="section-header">{label}</span>
            </div>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.04em', fontFamily: 'DM Mono' }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Weekly chart */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
        <p className="section-header" style={{ marginBottom: 20 }}>Weekly activity</p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          {weekData.map(({ weekStart, label, saved, applied }) => (
            <div
              key={weekStart.toISOString()}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
            >
              <div style={{ height: 76, display: 'flex', alignItems: 'flex-end', gap: 2, width: '100%' }}>
                <div
                  title={`${saved} saved`}
                  style={{
                    flex: 1,
                    height: `${barHeight(saved)}px`,
                    background: saved > 0 ? '#d1d5db' : 'var(--border)',
                    borderRadius: '2px 2px 0 0',
                    transition: 'height 0.3s',
                  }}
                />
                <div
                  title={`${applied} applied`}
                  style={{
                    flex: 1,
                    height: `${barHeight(applied)}px`,
                    background: applied > 0 ? 'var(--yes)' : 'var(--border)',
                    borderRadius: '2px 2px 0 0',
                    transition: 'height 0.3s',
                  }}
                />
              </div>
              <span style={{ fontSize: 9, fontFamily: 'DM Mono', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#d1d5db' }} />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Saved</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--yes)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Applied</span>
          </div>
        </div>
      </div>

      {/* Activity feed */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <p className="section-header" style={{ marginBottom: 4 }}>Recent events</p>
        {events.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 12 }}>No activity yet.</p>
        ) : (
          <div>
            {events.slice(0, 40).map((event, i) => (
              <EventRow key={i} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
