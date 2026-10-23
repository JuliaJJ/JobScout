// src/lib/rubric.js
// Portfolio & resume revision rubric — shared by the Audit page and api/rubric-audit.js.
//
// Each criterion is scored 0 (missing), 1 (partial) or 2 (meets the bar).
// Evidence grade sets the weight: A = x3 (5+ independent sources), B = x2 (3–4 sources
// or primary evidence like job postings), C = x1 (sources split or single-source).
// Gap = weight x (2 - score). Sorting gaps high → low gives the revision plan.
//
// scorer — who produces the score:
//   'case_study' Claude scores each featured case study; the lowest score counts
//   'portfolio'  Claude scores the homepage + the set of portfolio pieces
//   'resume'     Claude scores the active resume
//   'site'       PageSpeed Insights against the live portfolio URL
//   'code'       computed in the browser from JobScout data
//   'self'       you score it on the Audit page (visual craft, interview readiness)
//
// allowNA — case-study criteria that may not apply to every study (scorer returns null).
// whenAllNA — what to do when no featured study applies: a score, or 'exclude' (drop from totals).
// needsLiveSite — depends on loading the live portfolio. When the site is password-protected,
//   these are left unscored (excluded from totals) rather than scored against the login page.
// boost — C-grade items only: if listing text matches, the weight rises to x2 for that audit.

export const RUBRIC_VERSION = '2026-10-22'

export const GRADE_WEIGHT = { A: 3, B: 2, C: 1 }

export const AREAS = [
  { id: 'positioning', label: 'Positioning and homepage' },
  { id: 'selection', label: 'Case study selection' },
  { id: 'content', label: 'Case study content' },
  { id: 'ai', label: 'AI, building and shipped work' },
  { id: 'craft', label: 'Craft and site quality' },
  { id: 'resume', label: 'Resume' },
  { id: 'interview', label: 'Interview readiness' },
]

export const CRITERIA = [
  // ── 1. Positioning and homepage ────────────────────────────────────────────
  { id: 'P1', needsLiveSite: true, area: 'positioning', grade: 'A', scorer: 'portfolio',
    criterion: 'One-sentence positioning',
    bar: 'First screen states domain, problem type and level of ownership.' },
  { id: 'P2', needsLiveSite: true, area: 'positioning', grade: 'B', scorer: 'portfolio',
    criterion: 'Named specialty',
    bar: 'Positioning names a domain (e.g. clinical/enterprise software, design systems, AI), not just "product designer".' },
  { id: 'P3', needsLiveSite: true, area: 'positioning', grade: 'B', scorer: 'portfolio',
    criterion: 'Work is one click away',
    bar: 'Case studies are reachable from the homepage with no hunting; featured work is not behind a password.' },
  { id: 'P4', needsLiveSite: true, area: 'positioning', grade: 'B', scorer: 'site',
    criterion: 'Phone-ready and fast',
    bar: 'Readable on a phone; loads quickly; no animation gating the content. Scored from the mobile PageSpeed performance score.' },
  { id: 'P5', needsLiveSite: true, area: 'positioning', grade: 'C', scorer: 'portfolio',
    criterion: 'Range is visible',
    bar: 'Below the specialty, side projects or earlier work show breadth.',
    boost: 'versatil|generalist|end-to-end|full[- ]stack|wear many hats|0 to 1|zero to one' },
  { id: 'P6', needsLiveSite: true, area: 'positioning', grade: 'C', scorer: 'portfolio',
    criterion: 'Common questions answered',
    bar: 'An About or writing section covers how you lead, handle conflict, and use AI.',
    boost: 'lead|leadership|mentor|influence|player[- ]coach|manage' },

  // ── 2. Case study selection ────────────────────────────────────────────────
  { id: 'S1', area: 'selection', grade: 'A', scorer: 'code',
    criterion: '3–5 featured studies',
    bar: 'No more than five featured; two or three picked out for interviews. Counted from pieces marked featured.' },
  { id: 'S2', area: 'selection', grade: 'A', scorer: 'portfolio',
    criterion: 'Aimed at the next role',
    bar: 'Each featured study matches the target role; older or off-target work moves to an "other work" strip.' },
  { id: 'S3', area: 'selection', grade: 'B', scorer: 'code',
    criterion: 'No weak link',
    bar: 'Every featured study could hold up in a deep dive. Derived from each study\'s average content score.' },
  { id: 'S4', area: 'selection', grade: 'B', scorer: 'portfolio',
    criterion: 'At least one verifiable shipped item',
    bar: 'A live link or a public artifact someone can check.' },
  { id: 'S5', area: 'selection', grade: 'C', scorer: 'portfolio',
    criterion: 'Deliberate mix',
    bar: 'One deep end-to-end study, one systems or strategy study, one built or AI study.',
    boost: 'design system|systems thinking|strategy|end-to-end|ai|machine learning|llm' },

  // ── 3. Case study content ──────────────────────────────────────────────────
  { id: 'C1', area: 'content', grade: 'A', scorer: 'case_study',
    criterion: 'Outcome first',
    bar: 'The result (a metric, or user/client evidence if no metric) appears in the first scroll — roughly the first 150 words.' },
  { id: 'C2', area: 'content', grade: 'A', scorer: 'case_study',
    criterion: 'Role and scope up top',
    bar: 'Your role, team size, partners, stakeholders and timeline are stated before the story starts.' },
  { id: 'C3', area: 'content', grade: 'A', scorer: 'case_study',
    criterion: 'Decisions visible',
    bar: 'Options considered, constraints, trade-offs, and what was cut are all on the page.' },
  { id: 'C4', area: 'content', grade: 'C', scorer: 'case_study',
    criterion: 'Real process artifacts, no ritual',
    bar: 'Keeps sketches, rejected ideas, and research that changed direction; drops framework diagrams (double diamond etc.) used as scaffolding.',
    boost: 'research|regulat|complian|healthcare|clinical|safety|hipaa|fda' },
  { id: 'C5', area: 'content', grade: 'B', scorer: 'case_study', allowNA: true, whenAllNA: 'exclude',
    criterion: 'Constraints from the domain',
    bar: 'Clinical safety, regulatory, EHR integration and engineering feasibility are shown where they shaped a decision.' },
  { id: 'C6', area: 'content', grade: 'B', scorer: 'case_study', allowNA: true, whenAllNA: 'exclude',
    criterion: 'NDA handled well',
    bar: 'Redacted or recreated screens; never "I can\'t share much". Not applicable if no confidentiality limits apply.' },
  { id: 'C7', area: 'content', grade: 'A', scorer: 'case_study',
    criterion: 'Skimmable with depth below',
    bar: 'Headings and short paragraphs; the gist reads in about 2 minutes; the full story is there for anyone who keeps reading.' },
  { id: 'C8', area: 'content', grade: 'C', scorer: 'case_study',
    criterion: 'Reflection',
    bar: 'Says what happened after launch and what you\'d change.',
    boost: 'growth mindset|learn|iterat|retro|feedback' },
  { id: 'C9', area: 'content', grade: 'C', scorer: 'case_study', allowNA: true, whenAllNA: 'exclude',
    criterion: 'Shipped matches design',
    bar: 'Where the shipped product differs from the designs, the case study explains why. Not applicable if nothing shipped or nothing diverged.',
    boost: 'ship|launch|production|deliver' },

  // ── 4. AI, building and shipped work ───────────────────────────────────────
  { id: 'A1', area: 'ai', grade: 'A', scorer: 'case_study', allowNA: true, whenAllNA: 0,
    criterion: 'AI named in the work',
    bar: 'Each relevant study says which AI tool, for what task, and what you kept, changed or threw out. Not applicable to studies that predate AI tools.' },
  { id: 'A2', area: 'ai', grade: 'B', scorer: 'case_study', allowNA: true, whenAllNA: 0,
    criterion: 'Judgment and guardrails',
    bar: 'Shows where AI got it wrong and how you applied accessibility, ethics or clinical oversight. Not applicable to studies with no AI use.' },
  { id: 'A3', area: 'ai', grade: 'B', scorer: 'portfolio',
    criterion: 'Proof you build',
    bar: 'A coded prototype or shipped side project with a live link.' },
  { id: 'A4', area: 'ai', grade: 'B', scorer: 'portfolio',
    criterion: 'Designing AI products',
    bar: 'At least one study is about designing an AI product or AI-ready system, not just using AI tools.' },
  { id: 'A5', area: 'ai', grade: 'C', scorer: 'self',
    criterion: 'Process video',
    bar: 'A short screen recording of you directing AI and making calls.',
    boost: '\\bai\\b|llm|machine learning|generative|prompt|agent' },

  // ── 5. Craft and site quality ──────────────────────────────────────────────
  { id: 'Q1', area: 'craft', grade: 'A', scorer: 'self',
    criterion: 'Typography, spacing and hierarchy',
    bar: 'Type pairing, rhythm and contrast hold up at a professional level on every page.' },
  { id: 'Q2', area: 'craft', grade: 'B', scorer: 'self',
    criterion: 'Realistic product screens',
    bar: 'Mockups look like real product surfaces with realistic content, ideally shown in context.' },
  { id: 'Q3', needsLiveSite: true, area: 'craft', grade: 'B', scorer: 'site',
    criterion: 'Accessible and bug-free',
    bar: 'Contrast passes WCAG, keyboard navigation and semantic headings work, images have alt text. Scored from the PageSpeed accessibility score; check keyboard use and broken links by hand.' },
  { id: 'Q4', area: 'craft', grade: 'B', scorer: 'case_study',
    criterion: 'Clear writing',
    bar: 'Short sentences, plain words, no padding.' },
  { id: 'Q5', area: 'craft', grade: 'C', scorer: 'self',
    criterion: 'Consistent identity',
    bar: 'One visual system across all case studies.',
    boost: 'visual design|brand|craft|polish|pixel' },

  // ── 6. Resume ──────────────────────────────────────────────────────────────
  { id: 'R1', area: 'resume', grade: 'B', scorer: 'self',
    criterion: 'Parses cleanly',
    bar: 'Single column, standard headings, no icons or skill bars; still readable when pasted as plain text. Check the exported file, not the text in JobScout.' },
  { id: 'R2', area: 'resume', grade: 'B', scorer: 'code',
    criterion: 'Portfolio link in the header',
    bar: 'Link sits next to your email (first lines of the resume), and bullets point to specific case studies.' },
  { id: 'R3', area: 'resume', grade: 'B', scorer: 'resume',
    criterion: 'Title and summary match the target',
    bar: 'Headline uses the target role title and names your domain.' },
  { id: 'R4', area: 'resume', grade: 'B', scorer: 'resume',
    criterion: 'Bullets show context, action and result',
    bar: 'Each bullet gives context, the decision you made, and a result or scale number.' },
  { id: 'R5', area: 'resume', grade: 'B', scorer: 'resume',
    criterion: 'Keywords mirrored where true',
    bar: 'Terms from target postings appear in context (design systems, research, prototyping, AI tools).' },
  { id: 'R6', area: 'resume', grade: 'B', scorer: 'resume',
    criterion: 'Seniority signals',
    bar: 'Shows ownership, scope, cross-functional influence and leadership (including AI enablement).' },
  { id: 'R7', area: 'resume', grade: 'B', scorer: 'resume',
    criterion: 'Concrete AI use',
    bar: 'At least one bullet names an AI workflow and what it changed.' },
  { id: 'R8', area: 'resume', grade: 'B', scorer: 'resume',
    criterion: 'One story across channels',
    bar: 'Resume, LinkedIn and portfolio use the same titles, dates, project names and positioning. Scored on the resume vs. your case studies (the Work section), plus the homepage when it is public; check LinkedIn by hand.' },
  { id: 'R9', area: 'resume', grade: 'C', scorer: 'code',
    criterion: 'Length and depth',
    bar: '1–2 pages; recent roles detailed, older ones condensed. Approximated from word count.' },
  { id: 'R10', area: 'resume', grade: 'C', scorer: 'resume',
    criterion: 'Consultancy framed as strength',
    bar: 'Your own consultancy reads as ownership and comfort with ambiguity, not a gap.',
    boost: 'ambigu|startup|founder|entrepreneur|0 to 1|zero to one|scrappy' },
  { id: 'R11', area: 'resume', grade: 'C', scorer: 'self',
    criterion: 'File format',
    bar: '.docx unless the posting asks for PDF.',
    boost: 'workday|taleo|icims|\\.docx|word document' },

  // ── 7. Interview readiness ─────────────────────────────────────────────────
  { id: 'I1', area: 'interview', grade: 'B', scorer: 'self',
    criterion: 'Two studies rehearsed as conversation',
    bar: 'You can walk through two studies while being interrupted and asked "why?" repeatedly.' },
  { id: 'I2', area: 'interview', grade: 'B', scorer: 'self',
    criterion: 'Craft deep dive',
    bar: 'For one project, you can explain type, spacing, color and interaction choices.' },
  { id: 'I3', area: 'interview', grade: 'B', scorer: 'self',
    criterion: 'Live exercise practiced',
    bar: 'Timed practice runs in Figma and with an AI prototyping tool.' },
  { id: 'I4', area: 'interview', grade: 'B', scorer: 'code',
    criterion: 'AI stories',
    bar: 'Three specific stories: tool, task, what you changed, outcome. Counted from STAR stories that mention AI tools.' },
  { id: 'I5', area: 'interview', grade: 'B', scorer: 'code',
    criterion: 'Disagreement stories',
    bar: 'Two stories about disagreeing with PM or engineering. Counted from STAR stories tagged conflict or influence.' },
  { id: 'I6', area: 'interview', grade: 'B', scorer: 'code',
    criterion: 'Warm network',
    bar: '15–20 people to reconnect with, plus a habit of sharing your work. Counted from contacts logged on listings.' },
  { id: 'I7', area: 'interview', grade: 'C', scorer: 'self',
    criterion: 'Deck version ready',
    bar: 'A deck covering two studies, for teams that ask for one.',
    boost: 'present|presentation|deck|portfolio review' },
  { id: 'I8', area: 'interview', grade: 'C', scorer: 'self',
    criterion: 'Raw files ready',
    bar: 'One clean, shareable working file per core study.',
    boost: 'figma|craft|working files|design files' },
  { id: 'I9', area: 'interview', grade: 'C', scorer: 'self',
    criterion: 'Scope slide',
    bar: 'One view of team size, stakeholders, and how your area fits the larger product.',
    boost: 'stakeholder|cross-functional|platform|ecosystem|staff|principal|lead' },
]

export const CRITERIA_BY_ID = Object.fromEntries(CRITERIA.map(c => [c.id, c]))

// Notes shown on criteria left unscored because the portfolio is password-protected.
export const PROTECTED_NOTE = 'Unscored: your portfolio is password-protected, so the audit can\'t see the live site. Check this one by hand.'
export const PROTECTED_P3_NOTE = 'Unscored by choice: your portfolio is password-protected because of NDA work. Reviewers who have to hunt for a password may move on, so put the password right next to the portfolio link on your resume and in every application.'

export function protectedScore(id) {
  return { score: null, unscored_reason: 'protected', note: id === 'P3' ? PROTECTED_P3_NOTE : PROTECTED_NOTE }
}

export function criteriaFor(scorer) {
  return CRITERIA.filter(c => c.scorer === scorer)
}

// ── Weights ─────────────────────────────────────────────────────────────────

// Combine the text of the listings in scope into one lowercase blob for boost matching.
export function listingText(listing) {
  return [
    listing.title, listing.seniority_level, listing.role_cluster,
    ...(listing.parsed_skills || []),
    ...(listing.parsed_requirements || []),
    ...(listing.parsed_nice_to_haves || []),
    listing.raw_text,
  ].filter(Boolean).join(' \n ').toLowerCase()
}

// Returns { [criterionId]: { weight, boosted, matchShare } }.
// For a single listing, a C item is boosted when its pattern matches that listing.
// For several listings (general scope), it is boosted when it matches at least 30% of them.
export function computeWeights(listings = []) {
  const texts = listings.map(listingText)
  const weights = {}
  for (const c of CRITERIA) {
    const base = GRADE_WEIGHT[c.grade]
    let boosted = false
    let matchShare = 0
    if (c.grade === 'C' && c.boost && texts.length) {
      const re = new RegExp(c.boost, 'i')
      const matches = texts.filter(t => re.test(t)).length
      matchShare = matches / texts.length
      boosted = texts.length === 1 ? matches === 1 : matchShare >= 0.3
    }
    weights[c.id] = { weight: boosted ? 2 : base, boosted, matchShare }
  }
  return weights
}

// ── Aggregation ─────────────────────────────────────────────────────────────

// Case-study criteria: per-study scores → one score. Lowest applicable score counts,
// because reviewers judge a portfolio by its weakest featured piece.
// Returns { score, excluded, lowestStudy }.
export function aggregateCaseStudy(criterion, perStudy) {
  const applicable = perStudy.filter(s => s.score !== null && s.score !== undefined)
  if (!applicable.length) {
    if (criterion.whenAllNA === 'exclude') return { score: null, excluded: true, lowestStudy: null }
    return { score: criterion.whenAllNA ?? 0, excluded: false, lowestStudy: null }
  }
  const lowest = applicable.reduce((min, s) => (s.score < min.score ? s : min), applicable[0])
  return { score: lowest.score, excluded: false, lowestStudy: lowest.title }
}

// scores: { [id]: { score: 0|1|2|null, excluded?: bool, ... } }
// weights: output of computeWeights
// Returns per-area totals, overall totals, and the gap list sorted high → low.
export function summarize(scores, weights) {
  const areas = Object.fromEntries(AREAS.map(a => [a.id, { ...a, points: 0, max: 0, scored: 0, unscored: 0 }]))
  const gaps = []
  let points = 0
  let max = 0
  const weakA = []

  for (const c of CRITERIA) {
    const s = scores[c.id]
    const w = weights[c.id]?.weight ?? GRADE_WEIGHT[c.grade]
    if (!s || s.excluded) continue
    if (s.score === null || s.score === undefined) {
      areas[c.area].unscored += 1
      continue
    }
    const earned = w * s.score
    areas[c.area].points += earned
    areas[c.area].max += w * 2
    areas[c.area].scored += 1
    points += earned
    max += w * 2
    const gap = w * (2 - s.score)
    if (gap > 0) gaps.push({ id: c.id, gap, weight: w, score: s.score })
    if (c.grade === 'A' && s.score < 2) weakA.push(c.id)
  }

  // Highest gap first; on ties, stronger evidence grade first, then rubric order.
  const gradeRank = { A: 0, B: 1, C: 2 }
  const order = Object.fromEntries(CRITERIA.map((c, i) => [c.id, i]))
  gaps.sort((a, b) =>
    b.gap - a.gap ||
    gradeRank[CRITERIA_BY_ID[a.id].grade] - gradeRank[CRITERIA_BY_ID[b.id].grade] ||
    order[a.id] - order[b.id]
  )

  return {
    areas: AREAS.map(a => areas[a.id]),
    points,
    max,
    pct: max ? Math.round((points / max) * 100) : 0,
    weakA,
    gaps,
  }
}

// ── Code-scored criteria ────────────────────────────────────────────────────

const AI_TERMS = /\b(ai|llm|gpt|chatgpt|claude|copilot|cursor|gemini|figma make|v0|lovable|bolt|midjourney|generative|prompt)\b/i

// Everything the browser can score without Claude. Inputs are rows straight from Supabase.
export function codeScores({ featured = [], studyAverages = [], resumeText = '', portfolioUrl = '', stories = [], listings = [] }) {
  const out = {}

  // S1 — featured count
  const n = featured.length
  out.S1 = {
    score: n >= 3 && n <= 5 ? 2 : n === 2 || n === 6 ? 1 : 0,
    evidence: `${n} piece${n === 1 ? '' : 's'} marked featured.`,
    fix: n > 5 ? 'Feature at most five; move the rest to an "other work" strip.'
      : n < 3 ? 'Mark three to five pieces as featured on this page.' : null,
  }

  // S3 — weakest study's average content score
  if (studyAverages.length) {
    const weakest = studyAverages.reduce((m, s) => (s.avg < m.avg ? s : m), studyAverages[0])
    out.S3 = {
      score: weakest.avg >= 1.5 ? 2 : weakest.avg >= 1 ? 1 : 0,
      evidence: `Weakest featured study: "${weakest.title}" averages ${weakest.avg.toFixed(2)} of 2 on content criteria.`,
      fix: weakest.avg < 1.5 ? `Strengthen or replace "${weakest.title}".` : null,
    }
  } else {
    out.S3 = { score: null, evidence: 'No featured studies were scored.' }
  }

  // R2 — portfolio link in the first lines of the resume
  const head = resumeText.slice(0, 500).toLowerCase()
  let host = ''
  try { host = portfolioUrl ? new URL(portfolioUrl).hostname.replace(/^www\./, '') : '' } catch { host = '' }
  const hasPortfolioHost = host && head.includes(host)
  const hasAnyLink = /(https?:\/\/|www\.|\.com|\.design|\.io|\.dev|\.me)\S*/.test(head)
  out.R2 = {
    score: hasPortfolioHost ? 2 : hasAnyLink ? 1 : 0,
    evidence: hasPortfolioHost ? `Header includes ${host}.`
      : hasAnyLink ? 'Header has a link, but not your portfolio URL from the Audit settings.'
      : 'No link found in the first lines of the resume.',
    fix: hasPortfolioHost ? null : 'Put your portfolio URL next to your email at the top of the resume.',
  }

  // R9 — length (≈ 450–550 words per page)
  const words = resumeText.trim() ? resumeText.trim().split(/\s+/).length : 0
  out.R9 = {
    score: words === 0 ? null : words >= 350 && words <= 1100 ? 2 : words <= 1400 ? 1 : 0,
    evidence: `${words} words (roughly ${Math.max(1, Math.round(words / 500))} page${words > 750 ? 's' : ''}).`,
    fix: words > 1100 ? 'Condense older roles to one or two lines each.'
      : words > 0 && words < 350 ? 'Add context and results to recent roles.' : null,
  }

  // I4 — AI stories in the STAR bank
  const storyText = s => [s.title, s.situation, s.task, s.action, s.result].filter(Boolean).join(' ')
  const aiStories = stories.filter(s => AI_TERMS.test(storyText(s)))
  out.I4 = {
    score: aiStories.length >= 3 ? 2 : aiStories.length >= 1 ? 1 : 0,
    evidence: `${aiStories.length} STAR stor${aiStories.length === 1 ? 'y mentions' : 'ies mention'} AI tools.`,
    fix: aiStories.length < 3 ? 'Add AI stories to the Prep story bank: tool, task, what you changed, outcome.' : null,
  }

  // I5 — disagreement stories
  const conflict = stories.filter(s => (s.behavioral_tags || []).some(t => t === 'conflict' || t === 'influence'))
  out.I5 = {
    score: conflict.length >= 2 ? 2 : conflict.length === 1 ? 1 : 0,
    evidence: `${conflict.length} STAR stor${conflict.length === 1 ? 'y' : 'ies'} tagged conflict or influence.`,
    fix: conflict.length < 2 ? 'Add a story about disagreeing with PM or engineering, and tag it conflict.' : null,
  }

  // I6 — contacts logged across listings (a proxy for an active network)
  const contactKeys = new Set()
  listings.forEach(l => (l.contacts || []).forEach(c => {
    const key = (c.email || c.linkedin || c.name || '').toLowerCase().trim()
    if (key) contactKeys.add(key)
  }))
  const nc = contactKeys.size
  out.I6 = {
    score: nc >= 15 ? 2 : nc >= 5 ? 1 : 0,
    evidence: `${nc} unique contact${nc === 1 ? '' : 's'} logged on listings (a proxy for an active network).`,
    fix: nc < 15 ? 'Build a list of 15–20 people to reconnect with and log them on listings.' : null,
  }

  return out
}

// PageSpeed scores (0–100) → rubric scores.
export function siteScores(psi) {
  if (!psi) return {}
  const perf = psi.performance
  const a11y = psi.accessibility
  return {
    P4: perf === null || perf === undefined ? { score: null, evidence: 'PageSpeed did not return a performance score.' } : {
      score: perf >= 85 ? 2 : perf >= 60 ? 1 : 0,
      evidence: `Mobile performance ${perf}/100${psi.lcp ? `; largest contentful paint ${psi.lcp}` : ''}.`,
      fix: perf < 85 ? 'Cut load time on mobile: compress images, defer non-critical scripts, avoid animation that gates content.' : null,
    },
    Q3: a11y === null || a11y === undefined ? { score: null, evidence: 'PageSpeed did not return an accessibility score.' } : {
      score: a11y >= 95 ? 2 : a11y >= 85 ? 1 : 0,
      evidence: `Accessibility ${a11y}/100${psi.a11yIssues?.length ? `; issues: ${psi.a11yIssues.join('; ')}` : ''}.`,
      fix: a11y < 95 ? 'Fix the flagged accessibility issues, then test keyboard navigation by hand.' : null,
    },
  }
}

// Map a Gap Analysis action priority onto the same gap scale so both lists can be merged.
// high = an A item scored 0, medium ≈ a B item scored 0, low ≈ a B item scored 1.
export const PRIORITY_GAP = { high: 6, medium: 4, low: 2 }
