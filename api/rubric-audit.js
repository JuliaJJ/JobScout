// api/rubric-audit.js
// Vercel serverless function — scores portfolio, case studies and resume against the revision rubric.
//
// One call per unit of work so each stays well inside the function time limit; the Audit page
// runs them in parallel and combines the results. Modes:
//   case_study  { study, target }            → content, AI and writing criteria for one study
//   portfolio   { homepageUrl, pieces, target } → positioning, selection and AI criteria
//   resume      { resume, homepageUrl, target, keywords } → resume criteria
//   site        { url }                      → PageSpeed Insights performance + accessibility

import Anthropic from '@anthropic-ai/sdk'
import { criteriaFor } from '../src/lib/rubric.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You are a strict, calibrated reviewer of senior product/UX design portfolios and resumes. You score material against a rubric used by design hiring managers.

Scoring:
- 2 = the bar is clearly met in the material. You must quote the exact words that show it.
- 1 = partly met, met only in places, or present but hard to find.
- 0 = missing.
- null = only where the criterion says it can be "not applicable" and it truly does not apply.

Rules:
- Judge only the material provided. Never assume something exists elsewhere.
- Do not reward intent, effort or length. Reward what a skimming hiring manager would actually see.
- The evidence field must be a short verbatim quote copied exactly from the material (under 40 words). Use an empty string when nothing in the material supports a score above 0.
- The fix field is one or two specific sentences saying what to change, written to the candidate as "you". Use null when the score is 2.
- Never invent metrics, employers, tools or outcomes in a fix; point to what is missing instead.`

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[*_`#>|]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

// True when the quote (minus any ellipses) appears in the material.
export function quoteFound(quote, material) {
  const m = normalize(material)
  const parts = normalize(quote)
    .replace(/^["']|["']$/g, '')
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map(p => p.trim())
    .filter(p => p.length >= 8)
  if (!parts.length) return false
  return parts.every(p => m.includes(p))
}

function stripMdx(src) {
  // Frontmatter stays in: it often holds role, team and timeline.
  return (src || '')
    .split('\n')
    .filter(line => !/^\s*(import|export)\s/.test(line))
    .join('\n')
    .trim()
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(h[1-6]|p|li|div|section|header|footer|nav|br)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

export async function fetchHomepage(url) {
  if (!url) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (JobScout portfolio audit)' },
      redirect: 'follow',
    })
    if (!res.ok) return { error: `Homepage returned HTTP ${res.status}` }
    const html = await res.text()
    const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(([, href, inner]) => `${htmlToText(inner).replace(/\s+/g, ' ').slice(0, 60) || '(no text)'} → ${href}`)
      .slice(0, 60)
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || ''
    const description = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1] || ''
    return {
      title,
      description,
      text: htmlToText(html).slice(0, 8000),
      links,
      hasPasswordField: /<input[^>]+type=["']password["']/i.test(html),
    }
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'Homepage took longer than 10 seconds to load' : e.message }
  } finally {
    clearTimeout(timer)
  }
}

function homepageBlock(home) {
  if (!home) return 'HOMEPAGE: no portfolio URL provided.'
  if (home.error) return `HOMEPAGE: could not be loaded (${home.error}).`
  return [
    `HOMEPAGE TITLE: ${home.title || '(none)'}`,
    home.description && `META DESCRIPTION: ${home.description}`,
    `PASSWORD FIELD ON HOMEPAGE: ${home.hasPasswordField ? 'yes' : 'no'}`,
    `HOMEPAGE TEXT (in page order; the first lines are the first screen):\n${home.text}`,
    `HOMEPAGE LINKS (text → href):\n${home.links.join('\n')}`,
  ].filter(Boolean).join('\n\n')
}

function rubricBlock(criteria) {
  return criteria.map(c =>
    `${c.id} — ${c.criterion}: ${c.bar}${c.allowNA ? ' (May be null if not applicable.)' : ''}`
  ).join('\n')
}

// Calls Claude with a forced tool so the scores come back as structured data.
async function scoreWithClaude({ criteria, material, context, task }) {
  const ids = criteria.map(c => c.id)
  const tool = {
    name: 'record_scores',
    description: 'Record one score per rubric criterion.',
    input_schema: {
      type: 'object',
      properties: {
        scores: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', enum: ids },
              score: { type: ['integer', 'null'], enum: [0, 1, 2, null] },
              evidence: { type: 'string' },
              fix: { type: ['string', 'null'] },
            },
            required: ['id', 'score', 'evidence', 'fix'],
          },
        },
      },
      required: ['scores'],
    },
  }

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [tool],
    tool_choice: { type: 'tool', name: 'record_scores' },
    messages: [{
      role: 'user',
      content: `${task}

TARGET ROLES (what the candidate is applying for):
${context || 'Senior, staff and lead roles in UX design, product design, design engineering and design technologist tracks.'}

RUBRIC — score every one of these exactly once:
${rubricBlock(criteria)}

MATERIAL:
${material}`,
    }],
  })

  const call = message.content.find(b => b.type === 'tool_use')
  if (!call) throw new Error('The scorer did not return scores. Please try again.')

  const out = {}
  for (const c of criteria) {
    const row = (call.input.scores || []).find(s => s.id === c.id)
    if (!row) { out[c.id] = { score: null, evidence: '', fix: null, note: 'Not scored.' }; continue }
    let score = row.score
    if (score === null && !c.allowNA) score = 0
    const evidence = (row.evidence || '').trim()
    const verified = evidence ? quoteFound(evidence, material) : false
    let note = null
    // A full score needs a quote that really exists in the material.
    if (score === 2 && !verified) {
      score = 1
      note = 'Downgraded from 2: the supporting quote was not found in the source.'
    }
    out[c.id] = { score, evidence, evidence_verified: verified, fix: score === 2 ? null : row.fix || null, note }
  }
  return out
}

// ── PageSpeed Insights ──────────────────────────────────────────────────────

async function runPageSpeed(url) {
  const params = new URLSearchParams({ url, strategy: 'mobile' })
  params.append('category', 'performance')
  params.append('category', 'accessibility')
  if (process.env.PAGESPEED_API_KEY) params.set('key', process.env.PAGESPEED_API_KEY)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 55000)
  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, { signal: controller.signal })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || `PageSpeed returned HTTP ${res.status}`)
    const lh = data.lighthouseResult || {}
    const cat = lh.categories || {}
    const pct = v => (typeof v === 'number' ? Math.round(v * 100) : null)
    const a11yRefs = cat.accessibility?.auditRefs || []
    const a11yIssues = a11yRefs
      .map(r => lh.audits?.[r.id])
      .filter(a => a && a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary')
      .map(a => a.title)
      .slice(0, 5)
    return {
      performance: pct(cat.performance?.score),
      accessibility: pct(cat.accessibility?.score),
      lcp: lh.audits?.['largest-contentful-paint']?.displayValue || null,
      a11yIssues,
    }
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'PageSpeed took too long. Try again in a minute.' : e.message)
  } finally {
    clearTimeout(timer)
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { mode } = req.body || {}

  try {
    if (mode === 'site') {
      const { url } = req.body
      if (!url) return res.status(400).json({ error: 'Portfolio URL required' })
      return res.json({ psi: await runPageSpeed(url) })
    }

    if (mode === 'case_study') {
      const { study, target } = req.body
      const body = stripMdx(study?.mdx_content || study?.description || '')
      if (!body) return res.status(400).json({ error: `"${study?.title || 'Untitled'}" has no description or MDX content to score.` })
      const material = [
        `CASE STUDY: ${study.title}`,
        study.type && `TYPE: ${study.type}`,
        study.url && `LINK: ${study.url}`,
        `CONTENT (first 150 words ≈ the first scroll):\n${body.slice(0, 24000)}`,
      ].filter(Boolean).join('\n')
      const scores = await scoreWithClaude({
        criteria: criteriaFor('case_study'),
        material,
        context: target,
        task: 'Score this single portfolio case study.',
      })
      return res.json({ scores })
    }

    if (mode === 'portfolio') {
      const { homepageUrl, pieces = [], target } = req.body
      const home = await fetchHomepage(homepageUrl)
      const pieceList = pieces.map(p => {
        const desc = (p.description || p.mdx_content || '').replace(/\s+/g, ' ').trim().slice(0, 400)
        return `- ${p.featured ? '[FEATURED] ' : ''}"${p.title}" (${p.type || 'Project'})${p.url ? ` — link: ${p.url}` : ' — no link'}${desc ? `\n  ${desc}` : ''}`
      }).join('\n')
      const material = `${homepageBlock(home)}\n\nPORTFOLIO PIECES IN JOBSCOUT:\n${pieceList || '(none)'}`
      const scores = await scoreWithClaude({
        criteria: criteriaFor('portfolio'),
        material,
        context: target,
        task: 'Score this portfolio as a whole. Homepage criteria (P1, P2, P3, P6) depend on the homepage; if it could not be loaded, score them 0 and say so in the fix.',
      })
      return res.json({ scores, homepage: home?.error ? { error: home.error } : { title: home?.title || '' } })
    }

    if (mode === 'resume') {
      const { resume, homepageUrl, target, keywords = [] } = req.body
      if (!resume) return res.status(400).json({ error: 'Resume required' })
      const home = await fetchHomepage(homepageUrl)
      const material = [
        `RESUME:\n${resume.slice(0, 12000)}`,
        `KEYWORDS FROM TARGET POSTINGS (for R5): ${keywords.slice(0, 40).join(', ') || '(none provided)'}`,
        `PORTFOLIO HOMEPAGE, for comparing titles and positioning (R8):\n${home && !home.error ? home.text.slice(0, 3000) : '(not available)'}`,
      ].join('\n\n')
      const scores = await scoreWithClaude({
        criteria: criteriaFor('resume'),
        material,
        context: target,
        task: 'Score this resume. Quote evidence from the RESUME section unless the criterion is about the portfolio comparison.',
      })
      return res.json({ scores })
    }

    return res.status(400).json({ error: `Unknown mode "${mode}"` })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
