// src/lib/auditRun.js
// Orchestrates a rubric audit in the browser: builds the target-role context, calls
// /api/rubric-audit once per unit of work in parallel, and merges everything into one score set.

import {
  CRITERIA, CRITERIA_BY_ID, criteriaFor, computeWeights,
  aggregateCaseStudy, codeScores, siteScores, protectedScore,
} from './rubric.js'

// Listings that define "the job you want next" for this audit.
export function scopeListings(listings, scope) {
  if (scope && scope !== 'general') return listings.filter(l => l.id === scope)
  const yes = listings.filter(l => l.interest_rating === 'yes')
  return yes.length ? yes : listings
}

function topCounts(values, n) {
  const freq = {}
  values.filter(Boolean).forEach(v => { freq[v] = (freq[v] || 0) + 1 })
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n)
}

export function buildTarget(listings) {
  if (!listings.length) return ''
  if (listings.length === 1) {
    const l = listings[0]
    return [
      `${l.title || 'Role'}${l.company ? ` at ${l.company}` : ''}`,
      l.seniority_level && `Seniority: ${l.seniority_level}`,
      l.role_cluster && `Track: ${l.role_cluster}`,
      l.parsed_requirements?.length && `Requirements:\n- ${l.parsed_requirements.slice(0, 10).join('\n- ')}`,
      l.parsed_skills?.length && `Skills: ${l.parsed_skills.slice(0, 20).join(', ')}`,
    ].filter(Boolean).join('\n')
  }
  const titles = topCounts(listings.map(l => l.title), 8).map(([t, c]) => `${t}${c > 1 ? ` (x${c})` : ''}`)
  const clusters = topCounts(listings.map(l => l.role_cluster), 5).map(([t, c]) => `${t}: ${c}`)
  const seniority = topCounts(listings.map(l => l.seniority_level), 5).map(([t, c]) => `${t}: ${c}`)
  return [
    `${listings.length} target listings. Titles: ${titles.join('; ')}`,
    clusters.length && `Tracks: ${clusters.join(', ')}`,
    seniority.length && `Seniority: ${seniority.join(', ')}`,
    `Most requested skills: ${topKeywords(listings, 20).join(', ')}`,
  ].filter(Boolean).join('\n')
}

export function topKeywords(listings, n = 40) {
  return topCounts(listings.flatMap(l => l.parsed_skills || []), n).map(([k]) => k)
}

async function post(body) {
  const res = await fetch('/api/rubric-audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let data
  try { data = await res.json() } catch { throw new Error('Timed out — try again.') }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

const CONTENT_IDS = CRITERIA.filter(c => c.area === 'content').map(c => c.id)

// onStep(key, patch) reports progress: { label, status: 'running' | 'done' | 'error', error? }
export async function runAudit({ scope, listings, pieces, resume, portfolioUrl, stories, selfScores, onStep }) {
  const inScope = scopeListings(listings, scope)
  const weights = computeWeights(inScope)
  const target = buildTarget(inScope)
  const keywords = topKeywords(inScope)
  const featured = pieces.filter(p => p.featured)
  const errors = []

  async function step(key, label, fn) {
    onStep?.(key, { label, status: 'running' })
    try {
      const out = await fn()
      onStep?.(key, { label, status: 'done' })
      return out
    } catch (e) {
      onStep?.(key, { label, status: 'error', error: e.message })
      errors.push({ step: label, error: e.message })
      return null
    }
  }

  const sitePromise = portfolioUrl
    ? step('site', 'PageSpeed: performance and accessibility', () => post({ mode: 'site', url: portfolioUrl }))
    : Promise.resolve(null)

  const portfolioPromise = step('portfolio', 'Homepage and portfolio set', () => post({
    mode: 'portfolio',
    homepageUrl: portfolioUrl || null,
    target,
    pieces: pieces.map(p => ({
      title: p.title, type: p.type, url: p.url, featured: !!p.featured,
      description: p.description, mdx_content: p.mdx_content,
    })),
  }))

  const resumePromise = resume?.content
    ? step('resume', 'Resume', () => post({
      mode: 'resume', resume: resume.content, homepageUrl: portfolioUrl || null, target, keywords,
      // Featured studies (or every case study if none are featured) stand in for the Work section.
      caseStudies: (featured.length ? featured : pieces.filter(p => p.type === 'Case Study'))
        .filter(p => p.mdx_content || p.description)
        .map(p => ({ title: p.title, mdx_content: p.mdx_content, description: p.description })),
    }))
    : Promise.resolve(null)

  const studyPromises = featured.map(p =>
    step(`study:${p.id}`, `Case study: ${p.title}`, () => post({
      mode: 'case_study',
      target,
      study: { title: p.title, type: p.type, url: p.url, description: p.description, mdx_content: p.mdx_content },
    })).then(r => (r ? { piece: p, scores: r.scores } : null))
  )

  const [site, portfolio, resumeRes, ...studies] = await Promise.all([
    sitePromise, portfolioPromise, resumePromise, ...studyPromises,
  ])

  const scores = {}
  const mark = (obj, source) => Object.entries(obj || {}).forEach(([id, s]) => { scores[id] = { ...s, source } })

  // Case studies → one score per criterion (lowest applicable study counts).
  const scoredStudies = studies.filter(Boolean)
  for (const c of criteriaFor('case_study')) {
    if (!scoredStudies.length) { scores[c.id] = { score: null, source: 'claude', note: 'No featured case studies were scored.' }; continue }
    const perStudy = scoredStudies.map(({ piece, scores: s }) => ({ title: piece.title, ...(s[c.id] || { score: null }) }))
    const agg = aggregateCaseStudy(c, perStudy)
    const lowest = perStudy.find(s => s.title === agg.lowestStudy)
    scores[c.id] = {
      score: agg.score,
      excluded: agg.excluded,
      evidence: lowest?.evidence || '',
      evidence_verified: lowest?.evidence_verified,
      fix: lowest?.fix || (agg.score === 0 && !lowest ? `No featured study shows this. ${c.bar}` : null),
      note: lowest?.note || null,
      lowest_study: agg.lowestStudy,
      per_study: perStudy,
      source: 'claude',
    }
  }

  const studyAverages = scoredStudies.map(({ piece, scores: s }) => {
    const vals = CONTENT_IDS.map(id => s[id]?.score).filter(v => v !== null && v !== undefined)
    return { title: piece.title, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 }
  })

  mark(portfolio?.scores, 'claude')
  mark(resumeRes?.scores, 'claude')
  if (site?.psi) mark(siteScores(site.psi), 'pagespeed')
  const siteProtected = !!(site?.protected || portfolio?.homepage?.protected)
  if (siteProtected) criteriaFor('site').forEach(c => { scores[c.id] = { ...protectedScore(c.id), source: 'pagespeed' } })
  mark(codeScores({
    featured, studyAverages, resumeText: resume?.content || '', portfolioUrl, stories, listings,
  }), 'computed')
  // S3 needs at least one scored study.
  if (!scoredStudies.length) scores.S3 = { score: null, source: 'computed', note: 'No featured case studies were scored.' }

  // Self-assessed criteria.
  for (const c of criteriaFor('self')) {
    const s = selfScores?.[c.id]
    scores[c.id] = { score: s?.score ?? null, evidence: s?.notes || '', source: 'self' }
  }

  // Anything a failed step should have produced stays unscored, with the reason.
  for (const c of CRITERIA) {
    if (!scores[c.id]) {
      const why = c.scorer === 'site' && !portfolioUrl ? 'Add your portfolio URL to score this.'
        : c.scorer === 'resume' && !resume?.content ? 'No active resume saved.'
        : 'The scoring step for this criterion failed.'
      scores[c.id] = { score: null, source: c.scorer === 'site' ? 'pagespeed' : 'claude', note: why }
    }
  }

  return {
    weights,
    scores,
    psi: site?.psi || null,
    homepage: portfolio?.homepage || null,
    errors,
    siteProtected,
    featuredIds: featured.map(p => p.id),
    inScopeCount: inScope.length,
  }
}

// Overlay the latest self-assessments onto a saved audit's scores.
export function withSelfScores(scores, selfScores) {
  const out = { ...scores }
  for (const c of criteriaFor('self')) {
    const s = selfScores?.[c.id]
    out[c.id] = { ...(out[c.id] || {}), score: s?.score ?? null, evidence: s?.notes || '', source: 'self' }
  }
  return out
}

export { CRITERIA_BY_ID }
