// api/gap-analysis.js
// Vercel serverless function — runs gap analysis between resume and job listings

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a senior UX/product design career coach. You give specific, actionable advice. Return ONLY valid JSON with no preamble or markdown fences. The candidate is targeting senior, staff, and lead roles in UX design, product design, design engineering, and design technologist tracks.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { resume, listings } = req.body
  if (!resume || !listings?.length) {
    return res.status(400).json({ error: 'Resume and listings required' })
  }

  // Build skill frequency map (weighted by interest)
  const skillFreq = {}
  const weightedTotal = listings.reduce((sum, l) => sum + (l.interest_rating === 'yes' ? 2 : 1), 0)

  listings.forEach(l => {
    const weight = l.interest_rating === 'yes' ? 2 : 1;
    (l.skills || []).forEach(s => {
      skillFreq[s] = (skillFreq[s] || 0) + weight
    })
  })

  const topSkills = Object.entries(skillFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([skill, count]) => `${skill} (${Math.round(count / weightedTotal * 100)}%)`)
    .join(', ')

  const sampleListings = listings.slice(0, 8).map(l =>
    `- ${l.title} at ${l.company || 'unknown'} [${l.interest_rating}] [${l.role_cluster || 'ux'}]: ${(l.requirements || []).slice(0, 4).join('; ')}`
  ).join('\n')

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{
        role: 'user',
        content: `Analyze this designer's resume against their target job market and return a gap analysis.

RESUME:
${resume.slice(0, 4000)}

TOP SKILLS REQUESTED (weighted by interest rating, yes=2x, maybe=1x):
${topSkills}

SAMPLE TARGET LISTINGS (${listings.length} total):
${sampleListings}

Return ONLY a JSON object with this exact structure:
{
  "summary": "2-3 paragraph honest assessment of positioning, strengths, and main gaps",
  "skills_present": ["skills clearly evident in resume that are highly sought"],
  "skills_partial": ["skills implied or partially demonstrated but not clearly articulated"],
  "skills_missing": ["skills frequently requested that are absent from resume"],
  "action_plan": [
    {
      "action": "short action title",
      "priority": "high|medium|low",
      "rationale": "one sentence why this matters",
      "detail": "specific tactical advice",
      "resume_suggestion": "example resume bullet or language if applicable, otherwise null"
    }
  ]
}

Order action_plan by impact. Include 8-12 action items. Be specific to a senior/staff UX designer with technical skills (React, JS, Swift, HTML/CSS).`
      }],
    })

    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '{}'

    let parsed
    try {
      parsed = JSON.parse(responseText.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      throw new Error('Analysis failed to parse. Please try again.')
    }

    res.json(parsed)

  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
