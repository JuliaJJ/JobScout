import { useState, useEffect, useRef } from 'react'
import { Save, Clock, Upload, Plus, Trash2, ChevronUp, ChevronDown, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const EMPTY = { summary: '', experience: [], education: [], skills: [], certifications: [] }

const newExp = () => ({ id: crypto.randomUUID(), title: '', company: '', location: '', startDate: '', endDate: '', current: false, bullets: [''] })
const newEdu = () => ({ id: crypto.randomUUID(), degree: '', field: '', institution: '', graduationYear: '' })
const newSkillGroup = () => ({ id: crypto.randomUUID(), category: '', items: [] })
const newCert = () => ({ id: crypto.randomUUID(), name: '', issuer: '', year: '' })

function withIds(data) {
  return {
    summary: data.summary || '',
    experience: (data.experience || []).map(e => ({ ...newExp(), ...e, id: e.id || crypto.randomUUID() })),
    education: (data.education || []).map(e => ({ ...newEdu(), ...e, id: e.id || crypto.randomUUID() })),
    skills: (data.skills || []).map(g => ({ ...newSkillGroup(), ...g, id: g.id || crypto.randomUUID() })),
    certifications: (data.certifications || []).map(c => ({ ...newCert(), ...c, id: c.id || crypto.randomUUID() })),
  }
}

function serialize(s) {
  const parts = []

  if (s.summary?.trim()) {
    parts.push('SUMMARY\n\n' + s.summary.trim())
  }

  if (s.experience?.length) {
    const lines = s.experience.map(e => {
      const header = [e.title, e.company, e.location].filter(Boolean).join(' · ')
      const dates = e.current ? `${e.startDate} – Present` : [e.startDate, e.endDate].filter(Boolean).join(' – ')
      const bullets = (e.bullets || []).filter(Boolean).map(b => `• ${b}`).join('\n')
      return [header, dates, bullets].filter(Boolean).join('\n')
    }).join('\n\n')
    parts.push('EXPERIENCE\n\n' + lines)
  }

  if (s.education?.length) {
    const lines = s.education.map(e => {
      const degField = [e.degree, e.field].filter(Boolean).join(' in ')
      const instYear = [e.institution, e.graduationYear].filter(Boolean).join(', ')
      return [degField, instYear].filter(Boolean).join('\n')
    }).join('\n\n')
    parts.push('EDUCATION\n\n' + lines)
  }

  if (s.skills?.length) {
    const lines = s.skills
      .filter(g => g.category || g.items?.length)
      .map(g => `${g.category}: ${(g.items || []).join(', ')}`)
      .join('\n')
    if (lines) parts.push('SKILLS\n\n' + lines)
  }

  if (s.certifications?.length) {
    const lines = s.certifications
      .filter(c => c.name)
      .map(c => `${c.name}${c.issuer ? ' — ' + c.issuer : ''}${c.year ? ` (${c.year})` : ''}`)
      .join('\n')
    if (lines) parts.push('CERTIFICATIONS\n\n' + lines)
  }

  return parts.join('\n\n──────────────────\n\n')
}

export default function ResumePage() {
  const [structured, setStructured] = useState(EMPTY)
  const [label, setLabel] = useState('Current Resume')
  const [versions, setVersions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const [plainTextFallback, setPlainTextFallback] = useState(null)
  const fileInputRef = useRef(null)

  async function load() {
    const { data } = await supabase
      .from('resume_versions')
      .select('*')
      .order('created_at', { ascending: false })
    setVersions(data || [])
    const active = data?.find(v => v.is_active)
    if (active) applyVersion(active)
  }

  function applyVersion(v) {
    setActiveId(v.id)
    setLabel(v.label)
    if (v.structured_data) {
      setStructured(withIds(v.structured_data))
      setPlainTextFallback(null)
    } else {
      setStructured(EMPTY)
      setPlainTextFallback(v.content || '')
    }
  }

  useEffect(() => { load() }, [])

  // ── State helpers ──────────────────────────────────────────────

  function upd(field, value) {
    setStructured(s => ({ ...s, [field]: value }))
  }

  function updExp(id, field, value) {
    setStructured(s => ({ ...s, experience: s.experience.map(e => e.id === id ? { ...e, [field]: value } : e) }))
  }

  function addBullet(expId) {
    setStructured(s => ({
      ...s,
      experience: s.experience.map(e => e.id === expId ? { ...e, bullets: [...e.bullets, ''] } : e),
    }))
  }

  function insertBulletAfter(expId, idx) {
    setStructured(s => ({
      ...s,
      experience: s.experience.map(e => {
        if (e.id !== expId) return e
        const bullets = [...e.bullets]
        bullets.splice(idx + 1, 0, '')
        return { ...e, bullets }
      }),
    }))
  }

  function updBullet(expId, idx, value) {
    setStructured(s => ({
      ...s,
      experience: s.experience.map(e => {
        if (e.id !== expId) return e
        const bullets = [...e.bullets]
        bullets[idx] = value
        return { ...e, bullets }
      }),
    }))
  }

  function removeBullet(expId, idx) {
    setStructured(s => ({
      ...s,
      experience: s.experience.map(e =>
        e.id === expId ? { ...e, bullets: e.bullets.filter((_, i) => i !== idx) } : e
      ),
    }))
  }

  function moveExp(id, dir) {
    setStructured(s => {
      const arr = [...s.experience]
      const idx = arr.findIndex(e => e.id === id)
      const next = idx + dir
      if (next < 0 || next >= arr.length) return s
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return { ...s, experience: arr }
    })
  }

  function updEdu(id, field, value) {
    setStructured(s => ({ ...s, education: s.education.map(e => e.id === id ? { ...e, [field]: value } : e) }))
  }

  function updSkillGroup(id, field, value) {
    setStructured(s => ({ ...s, skills: s.skills.map(g => g.id === id ? { ...g, [field]: value } : g) }))
  }

  function updSkillItems(id, raw) {
    const items = raw.split(',').map(x => x.trim()).filter(Boolean)
    updSkillGroup(id, 'items', items)
  }

  function updCert(id, field, value) {
    setStructured(s => ({ ...s, certifications: s.certifications.map(c => c.id === id ? { ...c, [field]: value } : c) }))
  }

  // ── Persistence ────────────────────────────────────────────────

  async function save() {
    setSaving(true)
    const content = serialize(structured)
    await supabase.from('resume_versions').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
    if (activeId) {
      await supabase.from('resume_versions').update({ content, label, structured_data: structured, is_active: true }).eq('id', activeId)
    } else {
      const { data } = await supabase.from('resume_versions').insert({ content, label, structured_data: structured, is_active: true }).select().single()
      setActiveId(data?.id)
    }
    setSaving(false)
    setSaved(true)
    setPlainTextFallback(null)
    setTimeout(() => setSaved(false), 2000)
    load()
  }

  async function saveAsNew() {
    setSaving(true)
    const newLabel = label + ' (copy)'
    const content = serialize(structured)
    await supabase.from('resume_versions').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
    const { data } = await supabase.from('resume_versions').insert({ content, label: newLabel, structured_data: structured, is_active: true }).select().single()
    setActiveId(data?.id)
    setLabel(newLabel)
    setSaving(false)
    load()
  }

  // ── Import ─────────────────────────────────────────────────────

  async function parseToStructured(text) {
    if (!text?.trim()) return
    setImporting(true)
    try {
      const res = await fetch('/api/parse-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStructured(withIds(data))
      setPlainTextFallback(null)
    } catch (e) {
      alert('Import failed: ' + e.message)
    } finally {
      setImporting(false)
    }
  }

  async function handlePdfUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setImporting(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const pageTexts = []
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const lines = []
        let lastY = null
        let currentLine = []
        for (const item of textContent.items) {
          const y = item.transform[5]
          if (lastY !== null && Math.abs(y - lastY) > 3) {
            if (currentLine.length) lines.push(currentLine.join(' ').trim())
            currentLine = []
          }
          if (item.str.trim()) currentLine.push(item.str)
          lastY = y
        }
        if (currentLine.length) lines.push(currentLine.join(' ').trim())
        const pageText = lines.filter(Boolean).join('\n')
        if (pageText) pageTexts.push(pageText)
      }
      await parseToStructured(pageTexts.join('\n\n'))
    } catch (err) {
      alert('Could not read PDF: ' + err.message)
      setImporting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Resume</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 2 }}>
            Structured resume · powers gap analysis comparisons
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing || saving}>
            {importing
              ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Importing…</>
              : <><Upload size={13} /> Upload PDF</>
            }
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handlePdfUpload} />
          {versions.length > 0 && (
            <button className="btn btn-secondary" onClick={saveAsNew} disabled={saving || importing}>
              Save as new version
            </button>
          )}
          <button className="btn btn-primary" onClick={save} disabled={saving || importing}>
            <Save size={13} />
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save resume'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Version label */}
          <div>
            <label className="label">Version label</label>
            <input className="input" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Senior UX — Q1 2025" style={{ maxWidth: 320 }} />
          </div>

          {/* Plain-text migration banner */}
          {plainTextFallback !== null && (
            <div className="card" style={{ padding: 16, borderColor: 'var(--accent)' }}>
              <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>This version is stored as plain text</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
                Parse it into the structured form using AI, or fill in the sections below manually.
              </p>
              <button className="btn btn-secondary" onClick={() => parseToStructured(plainTextFallback)} disabled={importing}>
                <Sparkles size={12} />
                {importing ? 'Parsing…' : 'Parse into structured form'}
              </button>
            </div>
          )}

          {/* ── Summary ─────────────────────────────────────────── */}
          <div className="card" style={{ padding: 20 }}>
            <p className="section-header" style={{ marginBottom: 12 }}>Summary</p>
            <textarea
              className="input"
              style={{ minHeight: 80, fontSize: 13, lineHeight: 1.7, resize: 'vertical' }}
              value={structured.summary}
              onChange={e => upd('summary', e.target.value)}
              placeholder="Professional summary or objective statement…"
            />
          </div>

          {/* ── Experience ──────────────────────────────────────── */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p className="section-header">Experience</p>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => upd('experience', [...structured.experience, newExp()])}>
                <Plus size={12} /> Add role
              </button>
            </div>

            {structured.experience.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No experience added yet. Upload a PDF or add a role manually.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {structured.experience.map((e, idx) => (
                <div key={e.id} style={{
                  paddingBottom: 24,
                  paddingTop: idx > 0 ? 24 : 0,
                  borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                }}>
                  {/* Title / company row */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label className="label">Job title</label>
                      <input className="input" value={e.title}
                        onChange={ev => updExp(e.id, 'title', ev.target.value)}
                        placeholder="Senior UX Designer" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="label">Company</label>
                      <input className="input" value={e.company}
                        onChange={ev => updExp(e.id, 'company', ev.target.value)}
                        placeholder="Acme Corp" />
                    </div>
                    {/* Up/down reorder */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 3 }}>
                      <button onClick={() => moveExp(e.id, -1)} disabled={idx === 0}
                        style={{ padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'white', cursor: 'pointer', opacity: idx === 0 ? 0.3 : 1 }}>
                        <ChevronUp size={11} />
                      </button>
                      <button onClick={() => moveExp(e.id, 1)} disabled={idx === structured.experience.length - 1}
                        style={{ padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'white', cursor: 'pointer', opacity: idx === structured.experience.length - 1 ? 0.3 : 1 }}>
                        <ChevronDown size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Location / dates row */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label className="label">Location</label>
                      <input className="input" value={e.location}
                        onChange={ev => updExp(e.id, 'location', ev.target.value)}
                        placeholder="San Francisco, CA" />
                    </div>
                    <div>
                      <label className="label">Start</label>
                      <input className="input" style={{ width: 110 }} value={e.startDate}
                        onChange={ev => updExp(e.id, 'startDate', ev.target.value)}
                        placeholder="Jan 2022" />
                    </div>
                    <div>
                      <label className="label">End</label>
                      <input className="input" style={{ width: 110 }} value={e.endDate}
                        onChange={ev => updExp(e.id, 'endDate', ev.target.value)}
                        placeholder="Mar 2024" disabled={e.current} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
                      <input type="checkbox" id={`cur-${e.id}`} checked={e.current}
                        onChange={ev => updExp(e.id, 'current', ev.target.checked)} />
                      <label htmlFor={`cur-${e.id}`} style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                        Current
                      </label>
                    </div>
                  </div>

                  {/* Bullets */}
                  <label className="label" style={{ marginBottom: 6 }}>Highlights & accomplishments</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {e.bullets.map((b, bi) => (
                      <div key={bi} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 14, lineHeight: 1, flexShrink: 0 }}>•</span>
                        <input
                          className="input"
                          style={{ flex: 1, fontSize: 13 }}
                          value={b}
                          onChange={ev => updBullet(e.id, bi, ev.target.value)}
                          placeholder="Led redesign of checkout flow, reducing drop-off by 23%…"
                          onKeyDown={ev => {
                            if (ev.key === 'Enter') {
                              ev.preventDefault()
                              insertBulletAfter(e.id, bi)
                            }
                            if (ev.key === 'Backspace' && b === '' && e.bullets.length > 1) {
                              ev.preventDefault()
                              removeBullet(e.id, bi)
                            }
                          }}
                        />
                        <button
                          onClick={() => removeBullet(e.id, bi)}
                          disabled={e.bullets.length === 1}
                          style={{ padding: '4px 6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', opacity: e.bullets.length === 1 ? 0.3 : 1, flexShrink: 0 }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => addBullet(e.id)}>
                      <Plus size={11} /> Add bullet
                    </button>
                    <button
                      onClick={() => upd('experience', structured.experience.filter(ex => ex.id !== e.id))}
                      style={{ fontSize: 11, padding: '3px 8px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--no)' }}>
                      Remove role
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Education ───────────────────────────────────────── */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p className="section-header">Education</p>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => upd('education', [...structured.education, newEdu()])}>
                <Plus size={12} /> Add
              </button>
            </div>

            {structured.education.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No education added yet.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {structured.education.map((e, idx) => (
                <div key={e.id} style={{
                  display: 'flex', gap: 8, alignItems: 'flex-end',
                  paddingBottom: 16, paddingTop: idx > 0 ? 16 : 0,
                  borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ flex: 1 }}>
                    <label className="label">Degree</label>
                    <input className="input" value={e.degree}
                      onChange={ev => updEdu(e.id, 'degree', ev.target.value)}
                      placeholder="Bachelor of Fine Arts" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">Field</label>
                    <input className="input" value={e.field}
                      onChange={ev => updEdu(e.id, 'field', ev.target.value)}
                      placeholder="Graphic Design" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">Institution</label>
                    <input className="input" value={e.institution}
                      onChange={ev => updEdu(e.id, 'institution', ev.target.value)}
                      placeholder="Rhode Island School of Design" />
                  </div>
                  <div>
                    <label className="label">Year</label>
                    <input className="input" style={{ width: 80 }} value={e.graduationYear}
                      onChange={ev => updEdu(e.id, 'graduationYear', ev.target.value)}
                      placeholder="2015" />
                  </div>
                  <div style={{ paddingBottom: 8 }}>
                    <button
                      onClick={() => upd('education', structured.education.filter(ed => ed.id !== e.id))}
                      style={{ padding: '4px 6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Skills ──────────────────────────────────────────── */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p className="section-header">Skills</p>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => upd('skills', [...structured.skills, newSkillGroup()])}>
                <Plus size={12} /> Add category
              </button>
            </div>

            {structured.skills.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No skills added yet.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {structured.skills.map(g => (
                <div key={g.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: '0 0 180px' }}>
                    <label className="label">Category</label>
                    <input className="input" value={g.category}
                      onChange={ev => updSkillGroup(g.id, 'category', ev.target.value)}
                      placeholder="Design Tools" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">Skills (comma-separated)</label>
                    <input className="input" value={(g.items || []).join(', ')}
                      onChange={ev => updSkillItems(g.id, ev.target.value)}
                      placeholder="Figma, Sketch, Adobe XD" />
                  </div>
                  <div style={{ paddingBottom: 8 }}>
                    <button
                      onClick={() => upd('skills', structured.skills.filter(sg => sg.id !== g.id))}
                      style={{ padding: '4px 6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Certifications ──────────────────────────────────── */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p className="section-header">Certifications</p>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => upd('certifications', [...structured.certifications, newCert()])}>
                <Plus size={12} /> Add
              </button>
            </div>

            {structured.certifications.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No certifications added.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {structured.certifications.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 2 }}>
                    <label className="label">Name</label>
                    <input className="input" value={c.name}
                      onChange={ev => updCert(c.id, 'name', ev.target.value)}
                      placeholder="Google UX Design Certificate" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="label">Issuer</label>
                    <input className="input" value={c.issuer}
                      onChange={ev => updCert(c.id, 'issuer', ev.target.value)}
                      placeholder="Google / Coursera" />
                  </div>
                  <div>
                    <label className="label">Year</label>
                    <input className="input" style={{ width: 80 }} value={c.year}
                      onChange={ev => updCert(c.id, 'year', ev.target.value)}
                      placeholder="2024" />
                  </div>
                  <div style={{ paddingBottom: 8 }}>
                    <button
                      onClick={() => upd('certifications', structured.certifications.filter(cert => cert.id !== c.id))}
                      style={{ padding: '4px 6px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Version history ─────────────────────────────────── */}
        <div className="card" style={{ padding: 16 }}>
          <p className="section-header" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={11} /> Version history
          </p>
          {versions.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No saved versions yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {versions.map(v => (
                <button key={v.id} onClick={() => applyVersion(v)}
                  style={{
                    textAlign: 'left', padding: '8px 10px', borderRadius: 6,
                    border: '1px solid',
                    borderColor: v.id === activeId ? 'var(--accent)' : 'var(--border)',
                    background: v.id === activeId ? '#0a0a0a08' : 'white',
                    cursor: 'pointer', width: '100%',
                  }}>
                  <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{v.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'DM Mono' }}>
                    {new Date(v.created_at).toLocaleDateString()}
                    {v.is_active && <span style={{ color: 'var(--yes)', marginLeft: 6 }}>active</span>}
                    {!v.structured_data && <span style={{ color: 'var(--maybe)', marginLeft: 6 }}>plain text</span>}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
