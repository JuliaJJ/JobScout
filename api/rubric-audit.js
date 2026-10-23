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
import { criteriaFor, protectedScore } from '../src/lib/rubric.js'

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
    // Password gates: HTTP auth, a redirect to a hosting provider's login (e.g. Vercel SSO),
    // or a page whose main content is a password form.
    if (res.status === 401 || res.status === 403) return { protected: true, reason: `HTTP ${res.status}` }
    let finalHost = ''
    try { finalHost = new URL(res.url).hostname } catch { finalHost = '' }
    let startHost = ''
    try { startHost = new URL(url).hostname } catch { startHost = '' }
    if (finalHost && startHost && finalHost !== startHost && /(^|\.)vercel\.com$|(^|\.)netlify\.com$|auth|login|sso/i.test(finalHost)) {
      return { protected: true, reason: `redirected to ${finalHost}` }
    }
    if (!res.ok) return { error: `Homepage returned HTTP ${res.status}` }
    const html = await res.text()
    const hasPasswordField = /<input[^>]+type=["']?password/i.test(html)
    if (hasPasswordField) return { protected: true, reason: 'password form on the homepage' }
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
    // Deterministic as possible, so re-running an unchanged portfolio gives the same scores.
    temperature: 0,
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
      // PageSpeed against a password page would measure the login screen, not the portfolio.
      const home = await fetchHomepage(url)
      if (home?.protected) return res.json({ psi: null, protected: true, reason: home.reason })
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
      const isProtected = !!home?.protected
      const pieceList = pieces.map(p => {
        const desc = (p.description || p.mdx_content || '').replace(/\s+/g, ' ').trim().slice(0, 400)
        return `- ${p.featured ? '[FEATURED] ' : ''}"${p.title}" (${p.type || 'Project'})${p.url ? ` — link: ${p.url}` : ' — no link'}${desc ? `\n  ${desc}` : ''}`
      }).join('\n')
      const material = `${isProtected ? 'HOMEPAGE: password-protected; not available.' : homepageBlock(home)}\n\nPORTFOLIO PIECES IN JOBSCOUT:\n${pieceList || '(none)'}`
      // Homepage criteria can't be judged behind a password, so they are not sent to Claude at all.
      const criteria = criteriaFor('portfolio').filter(c => !(isProtected && c.needsLiveSite))
      const scores = await scoreWithClaude({
        criteria,
        material,
        context: target,
        task: 'Score this portfolio as a whole. Homepage criteria (P1, P2, P3, P6) depend on the homepage; if it could not be loaded, score them 0 and say so in the fix.',
      })
      if (isProtected) criteriaFor('portfolio').filter(c => c.needsLiveSite).forEach(c => { scores[c.id] = protectedScore(c.id) })
      return res.json({
        scores,
        homepage: isProtected ? { protected: true, reason: home.reason } : home?.error ? { error: home.error } : { title: home?.title || '' },
      })
    }

    if (mode === 'resume') {
      const { resume, homepageUrl, target, keywords = [], caseStudies = [] } = req.body
      if (!resume) return res.status(400).json({ error: 'Resume required' })
      const home = await fetchHomepage(homepageUrl)
      const isProtected = !!home?.protected
      // R8 compares the resume with the portfolio. The case studies are the Work section's content,
      // so they work even when the live site is password-protected.
      const studyExcerpts = caseStudies.slice(0, 8).map(cs => {
        const body = stripMdx(cs.mdx_content || cs.description || '').slice(0, 1500)
        return `--- ${cs.title} ---\n${body}`
      }).join('\n\n')
      const material = [
        `RESUME:\n${resume.slice(0, 12000)}`,
        `KEYWORDS FROM TARGET POSTINGS (for R5): ${keywords.slice(0, 40).join(', ') || '(none provided)'}`,
        `PORTFOLIO CASE STUDIES (the Work section; opening of each), for comparing titles, dates, project names and roles (R8):\n${studyExcerpts || '(none provided)'}`,
        `PORTFOLIO HOMEPAGE, for comparing positioning (R8):\n${home?.text ? home.text.slice(0, 3000) : isProtected ? '(password-protected; compare against the case studies only)' : '(not available)'}`,
      ].join('\n\n')
      const scores = await scoreWithClaude({
        criteria: criteriaFor('resume'),
        material,
        context: target,
        task: 'Score this resume. Quote evidence from the RESUME section unless the criterion is about the portfolio comparison.',
      })
      if (!studyExcerpts && !home?.text) {
        scores.R8 = { score: null, evidence: '', fix: null, note: 'Unscored: no case study content or public homepage to compare the resume against.' }
      } else if (!home?.text && scores.R8) {
        const basis = isProtected
          ? 'Scored against your case studies; homepage positioning wasn\'t checked because the site is password-protected.'
          : 'Scored against your case studies; the homepage couldn\'t be loaded.'
        scores.R8.note = scores.R8.note ? `${scores.R8.note} ${basis}` : basis
      }
      return res.json({ scores })
    }

    return res.status(400).json({ error: `Unknown mode "${mode}"` })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
