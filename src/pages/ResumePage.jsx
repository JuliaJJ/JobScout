import { useState, useEffect, useRef } from 'react'
import { Save, Clock, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export default function ResumePage() {
  const [content, setContent] = useState('')
  const [label, setLabel] = useState('Current Resume')
  const [versions, setVersions] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [parsing, setParsing] = useState(false)
  const fileInputRef = useRef(null)

  async function load() {
    const { data } = await supabase
      .from('resume_versions')
      .select('*')
      .order('created_at', { ascending: false })
    setVersions(data || [])
    const active = data?.find(v => v.is_active)
    if (active) {
      setContent(active.content)
      setLabel(active.label)
      setActiveId(active.id)
    }
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    // Deactivate all
    await supabase.from('resume_versions').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')

    if (activeId) {
      // Update existing
      await supabase.from('resume_versions').update({ content, label, is_active: true }).eq('id', activeId)
    } else {
      // Insert new
      const { data } = await supabase.from('resume_versions').insert({ content, label, is_active: true }).select().single()
      setActiveId(data?.id)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    load()
  }

  async function loadVersion(v) {
    setContent(v.content)
    setLabel(v.label)
    setActiveId(v.id)
  }

  async function saveAsNew() {
    setSaving(true)
    await supabase.from('resume_versions').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')
    const { data } = await supabase.from('resume_versions').insert({
      content, label: label + ' (copy)', is_active: true
    }).select().single()
    setActiveId(data?.id)
    setLabel(label + ' (copy)')
    setSaving(false)
    load()
  }

  async function handlePdfUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setParsing(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

      const pageTexts = []
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()

        // Group items into lines by y-coordinate, then join lines
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

      setContent(pageTexts.join('\n\n'))
    } catch (err) {
      alert('Could not parse PDF: ' + err.message)
    } finally {
      setParsing(false)
    }
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Resume</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 2 }}>
            Paste your resume text · used for gap analysis comparisons
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={parsing || saving}>
            {parsing
              ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Parsing…</>
              : <><Upload size={13} /> Upload PDF</>
            }
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handlePdfUpload} />
          {versions.length > 0 && (
            <button className="btn btn-secondary" onClick={saveAsNew} disabled={saving}>
              Save as new version
            </button>
          )}
          <button className="btn btn-primary" onClick={save} disabled={saving || !content.trim()}>
            <Save size={13} />
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save resume'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label className="label">Version label</label>
              <input className="input" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Senior UX — Q1 2025" />
            </div>
            <div style={{ paddingTop: 22, color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'DM Mono', whiteSpace: 'nowrap' }}>
              {wordCount} words
            </div>
          </div>
          <label className="label">Resume content (paste plain text or markdown)</label>
          <textarea
            className="input"
            style={{ minHeight: 520, fontFamily: 'DM Mono', fontSize: 12, lineHeight: 1.7 }}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={`Paste your resume here as plain text.\n\nInclude:\n- Summary / objective\n- Work experience with descriptions\n- Skills section\n- Education\n- Any relevant projects or certifications\n\nThe more detail you include, the more precise the gap analysis will be.`}
          />
        </div>

        {/* Version history */}
        <div className="card" style={{ padding: 16 }}>
          <p className="section-header" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={11} /> Version history
          </p>
          {versions.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No saved versions yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {versions.map(v => (
                <button
                  key={v.id}
                  onClick={() => loadVersion(v)}
                  style={{
                    textAlign: 'left', padding: '8px 10px', borderRadius: 6,
                    border: '1px solid',
                    borderColor: v.id === activeId ? 'var(--accent)' : 'var(--border)',
                    background: v.id === activeId ? '#0a0a0a08' : 'white',
                    cursor: 'pointer', width: '100%',
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{v.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'DM Mono' }}>
                    {new Date(v.created_at).toLocaleDateString()}
                    {v.is_active && <span style={{ color: 'var(--yes)', marginLeft: 6 }}>active</span>}
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
