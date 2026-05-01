import { useState, useEffect } from 'react'
import { Plus, X, ChevronDown, ChevronUp, Sparkles, Edit2, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const BEHAVIORAL_TAGS = [
  'leadership', 'influence', 'ambiguity', 'conflict',
  'impact', 'collaboration', 'feedback', 'failure',
]

const TAG_COLORS = {
  leadership:    { color: '#7c3aed', bg: '#f5f3ff' },
  influence:     { color: '#2563eb', bg: '#eff6ff' },
  ambiguity:     { color: '#d97706', bg: '#fffbeb' },
  conflict:      { color: '#dc2626', bg: '#fef2f2' },
  impact:        { color: '#16a34a', bg: '#f0fdf4' },
  collaboration: { color: '#0891b2', bg: '#ecfeff' },
  feedback:      { color: '#9333ea', bg: '#fdf4ff' },
  failure:       { color: '#64748b', bg: '#f8fafc' },
}

// ─── Story Modal ──────────────────────────────────────────────────────────────

function blankStoryForm() {
  return { title: '', situation: '', task: '', action: '', result: '', behavioral_tags: [] }
}

function StoryModal({ story, onClose, onSaved }) {
  const [form, setForm] = useState(
    story?.id
      ? { title: story.title || '', situation: story.situation || '', task: story.task || '', action: story.action || '', result: story.result || '', behavioral_tags: story.behavioral_tags || [] }
      : blankStoryForm()
  )
  const [saving, setSaving] = useState(false)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  function toggleTag(tag) {
    setForm(f => ({
      ...f,
      behavioral_tags: f.behavioral_tags.includes(tag)
        ? f.behavioral_tags.filter(t => t !== tag)
        : [...f.behavioral_tags, tag],
    }))
  }

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      situation: form.situation.trim(),
      task: form.task.trim(),
      action: form.action.trim(),
      result: form.result.trim(),
      behavioral_tags: form.behavioral_tags,
    }
    if (story?.id) {
      await supabase.from('interview_stories').update(payload).eq('id', story.id)
    } else {
      await supabase.from('interview_stories').insert(payload)
    }
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        className="card animate-in"
        style={{ width: 620, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{story?.id ? 'Edit Story' : 'Add Story'}</h2>
          <button className="btn btn-ghost" onClick={onClose}><X size={14} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Led cross-functional redesign under tight deadline"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label className="label">Behavioral tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {BEHAVIORAL_TAGS.map(tag => {
                const active = form.behavioral_tags.includes(tag)
                const colors = TAG_COLORS[tag]
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 500,
                      border: `1px solid ${active ? colors.color : 'var(--border)'}`,
                      background: active ? colors.bg : 'transparent',
                      color: active ? colors.color : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>

          {[
            { key: 'situation', label: 'Situation', placeholder: 'What was the context and challenge?' },
            { key: 'task',      label: 'Task',      placeholder: 'What was your specific responsibility?' },
            { key: 'action',    label: 'Action',    placeholder: 'What did you do, and why?' },
            { key: 'result',    label: 'Result',    placeholder: 'What was the outcome? Include metrics if possible.' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <textarea
                className="input"
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                style={{ width: '100%', minHeight: 72, resize: 'vertical' }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.title.trim()}>
            {saving ? 'Saving…' : 'Save Story'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Story Card ───────────────────────────────────────────────────────────────

function StoryCard({ story, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const hasContent = story.situation || story.task || story.action || story.result

  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, lineHeight: 1.3 }}>{story.title}</p>
          {story.behavioral_tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {story.behavioral_tags.map(tag => {
                const colors = TAG_COLORS[tag] || { color: 'var(--text-secondary)', bg: 'var(--bg)' }
                return (
                  <span key={tag} style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 500, color: colors.color, background: colors.bg }}>
                    {tag}
                  </span>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {hasContent && (
            <button className="btn btn-ghost" style={{ padding: '3px 6px' }} onClick={() => setExpanded(e => !e)}>
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
          <button className="btn btn-ghost" style={{ padding: '3px 6px' }} onClick={() => onEdit(story)}>
            <Edit2 size={11} />
          </button>
          <button className="btn btn-ghost" style={{ padding: '3px 6px', color: 'var(--no)' }} onClick={() => onDelete(story.id)}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {expanded && hasContent && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { key: 'situation', label: 'Situation' },
            { key: 'task',      label: 'Task' },
            { key: 'action',    label: 'Action' },
            { key: 'result',    label: 'Result' },
          ].map(({ key, label }) => story[key] ? (
            <div key={key}>
              <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</p>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{story[key]}</p>
            </div>
          ) : null)}
        </div>
      )}
    </div>
  )
}

// ─── Question Row ─────────────────────────────────────────────────────────────

function QuestionRow({ q, expanded, onToggle, onUpdateNotes, onRemove }) {
  return (
    <div className="card" style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <p style={{ fontSize: 13, flex: 1, lineHeight: 1.4 }}>{q.question}</p>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ padding: '2px 5px', color: 'var(--text-tertiary)' }} onClick={onToggle}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button className="btn btn-ghost" style={{ padding: '2px 5px', color: 'var(--text-tertiary)' }} onClick={() => onRemove(q.id)}>
            <X size={11} />
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <label className="label" style={{ marginBottom: 4 }}>Your notes / talking points</label>
          <textarea
            className="input"
            value={q.notes || ''}
            onChange={e => onUpdateNotes(q.id, e.target.value)}
            placeholder="Which STAR story fits? Key points to hit…"
            style={{ width: '100%', minHeight: 60, resize: 'vertical', fontSize: 13 }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Prep Panel ───────────────────────────────────────────────────────────────

function PrepPanel({ prep, generating, onGenerate, onSave }) {
  const [companyNotes, setCompanyNotes] = useState(prep.company_notes || '')
  const [questions, setQuestions] = useState(prep.anticipated_questions || [])
  const [toAsk, setToAsk] = useState(prep.questions_to_ask || [])
  const [expandedQ, setExpandedQ] = useState(null)
  const [newToAsk, setNewToAsk] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCompanyNotes(prep.company_notes || '')
    setQuestions(prep.anticipated_questions || [])
    setToAsk(prep.questions_to_ask || [])
    setDirty(false)
  }, [prep])

  function updateQuestionNotes(id, notes) {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, notes } : q))
    setDirty(true)
  }

  function removeQuestion(id) {
    setQuestions(qs => qs.filter(q => q.id !== id))
    setDirty(true)
  }

  function addToAsk() {
    if (!newToAsk.trim()) return
    setToAsk(prev => [...prev, { id: crypto.randomUUID(), question: newToAsk.trim() }])
    setNewToAsk('')
    setDirty(true)
  }

  function removeToAsk(id) {
    setToAsk(prev => prev.filter(q => q.id !== id))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    await onSave({ company_notes: companyNotes, anticipated_questions: questions, questions_to_ask: toAsk })
    setSaving(false)
    setDirty(false)
  }

  const behavioral = questions.filter(q => q.category === 'behavioral')
  const design = questions.filter(q => q.category === 'design')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 20 }}>
      {/* Company notes */}
      <div>
        <label className="label">Company &amp; role research notes</label>
        <textarea
          className="input"
          value={companyNotes}
          onChange={e => { setCompanyNotes(e.target.value); setDirty(true) }}
          placeholder="Culture, recent news, product direction, hiring manager context, anything worth remembering before the call…"
          style={{ width: '100%', minHeight: 90, resize: 'vertical' }}
        />
      </div>

      {/* Anticipated questions */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="section-header" style={{ margin: 0 }}>Anticipated questions</div>
          <button
            className="btn btn-primary"
            onClick={onGenerate}
            disabled={generating}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Sparkles size={13} />
            {generating ? 'Generating…' : questions.length > 0 ? 'Regenerate' : 'Generate with AI'}
          </button>
        </div>

        {questions.length === 0 && !generating && (
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: '12px 0' }}>
            Generate questions to get likely behavioral and design questions for this role.
          </p>
        )}

        {behavioral.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Behavioral</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {behavioral.map(q => (
                <QuestionRow
                  key={q.id}
                  q={q}
                  expanded={expandedQ === q.id}
                  onToggle={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                  onUpdateNotes={updateQuestionNotes}
                  onRemove={removeQuestion}
                />
              ))}
            </div>
          </div>
        )}

        {design.length > 0 && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Design / Portfolio</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {design.map(q => (
                <QuestionRow
                  key={q.id}
                  q={q}
                  expanded={expandedQ === q.id}
                  onToggle={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                  onUpdateNotes={updateQuestionNotes}
                  onRemove={removeQuestion}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Questions to ask */}
      <div>
        <div className="section-header" style={{ margin: 0, marginBottom: 10 }}>Questions to ask them</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {toAsk.map(q => (
            <div key={q.id} className="card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <p style={{ fontSize: 13, flex: 1, lineHeight: 1.4 }}>{q.question}</p>
              <button className="btn btn-ghost" style={{ padding: '2px 5px', color: 'var(--text-tertiary)', flexShrink: 0 }} onClick={() => removeToAsk(q.id)}>
                <X size={11} />
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={newToAsk}
              onChange={e => setNewToAsk(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addToAsk()}
              placeholder="Add your own question to ask…"
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" onClick={addToAsk} disabled={!newToAsk.trim()}>Add</button>
          </div>
        </div>
      </div>

      {dirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InterviewPage() {
  const [listings, setListings] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [prep, setPrep] = useState(null)
  const [stories, setStories] = useState([])
  const [storyFilter, setStoryFilter] = useState('all')
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingStory, setEditingStory] = useState(null)

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (selectedId) loadPrep(selectedId)
    else setPrep(null)
  }, [selectedId])

  async function load() {
    const [{ data: listingData }, { data: storyData }] = await Promise.all([
      supabase
        .from('job_listings')
        .select('id, title, company, role_cluster, parsed_skills, parsed_requirements, interest_rating')
        .neq('interest_rating', 'no')
        .eq('is_archived', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('interview_stories')
        .select('*')
        .order('created_at', { ascending: false }),
    ])
    setListings(listingData || [])
    setStories(storyData || [])
    setLoading(false)
  }

  async function loadPrep(listingId) {
    const { data } = await supabase
      .from('interview_prep')
      .select('*')
      .eq('listing_id', listingId)
      .maybeSingle()
    setPrep(data || { listing_id: listingId, company_notes: '', anticipated_questions: [], questions_to_ask: [] })
  }

  async function savePrep(updates) {
    if (prep?.id) {
      await supabase
        .from('interview_prep')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', prep.id)
      setPrep(p => ({ ...p, ...updates }))
    } else {
      const { data } = await supabase
        .from('interview_prep')
        .insert({ listing_id: selectedId, ...updates })
        .select()
        .single()
      setPrep(data)
    }
  }

  async function generateQuestions() {
    const listing = listings.find(l => l.id === selectedId)
    if (!listing) return

    const { data: resumeData } = await supabase
      .from('resume_versions')
      .select('content')
      .eq('is_active', true)
      .maybeSingle()

    setGenerating(true)
    try {
      const res = await fetch('/api/interview-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing, resume: resumeData?.content || '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')

      const anticipated = [
        ...(data.behavioral || []).map(q => ({ id: crypto.randomUUID(), question: q.question, category: 'behavioral', notes: '' })),
        ...(data.design || []).map(q => ({ id: crypto.randomUUID(), question: q.question, category: 'design', notes: '' })),
      ]
      const toAsk = (data.to_ask || []).map(q => ({ id: crypto.randomUUID(), question: q.question }))

      await savePrep({ anticipated_questions: anticipated, questions_to_ask: toAsk })
    } catch (e) {
      console.error('Interview question generation failed:', e)
    } finally {
      setGenerating(false)
    }
  }

  async function deleteStory(id) {
    if (!confirm('Delete this story?')) return
    await supabase.from('interview_stories').delete().eq('id', id)
    setStories(prev => prev.filter(s => s.id !== id))
  }

  const filteredStories = storyFilter === 'all'
    ? stories
    : stories.filter(s => s.behavioral_tags?.includes(storyFilter))

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-tertiary)' }}>
      <span className="spinner" />
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Interview Prep</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Per-listing prep and a reusable story bank for behavioral questions.
        </p>
      </div>

      {/* ── Listing Prep ── */}
      <div className="card" style={{ padding: 24, marginBottom: 40 }}>
        <div className="section-header" style={{ marginBottom: 14 }}>Listing Prep</div>

        <div>
          <label className="label">Select a listing</label>
          <select
            className="input"
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={{ maxWidth: 440 }}
          >
            <option value="">— pick a listing —</option>
            {listings.map(l => (
              <option key={l.id} value={l.id}>
                {l.title}{l.company ? ` @ ${l.company}` : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedId && prep ? (
          <PrepPanel
            key={selectedId}
            prep={prep}
            generating={generating}
            onGenerate={generateQuestions}
            onSave={savePrep}
          />
        ) : !selectedId ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 16 }}>
            Select a listing above to load or build its interview prep.
          </p>
        ) : null}
      </div>

      {/* ── STAR Story Bank ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div className="section-header" style={{ margin: 0 }}>STAR Story Bank</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
              Reusable stories for behavioral questions — not tied to any single listing.
            </p>
          </div>
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setEditingStory({})}>
            <Plus size={13} /> Add Story
          </button>
        </div>

        {/* Tag filter */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {['all', ...BEHAVIORAL_TAGS].map(tag => {
            const active = storyFilter === tag
            const colors = TAG_COLORS[tag] || null
            return (
              <button
                key={tag}
                onClick={() => setStoryFilter(tag)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 99,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: `1px solid ${active && colors ? colors.color : active ? 'var(--text-secondary)' : 'var(--border)'}`,
                  background: active && colors ? colors.bg : active ? 'var(--bg)' : 'transparent',
                  color: active && colors ? colors.color : active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
              >
                {tag}
              </button>
            )
          })}
        </div>

        {stories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)', fontSize: 13 }}>
            No stories yet. Add your first STAR story to build your bank.
          </div>
        ) : filteredStories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>
            No stories tagged "{storyFilter}".
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
            {filteredStories.map(story => (
              <StoryCard key={story.id} story={story} onEdit={setEditingStory} onDelete={deleteStory} />
            ))}
          </div>
        )}
      </div>

      {editingStory !== null && (
        <StoryModal
          story={editingStory?.id ? editingStory : null}
          onClose={() => setEditingStory(null)}
          onSaved={() => { load(); setEditingStory(null) }}
        />
      )}
    </div>
  )
}
