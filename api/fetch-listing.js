// api/fetch-listing.js
// Vercel serverless function — fetches a job URL OR parses pasted text via Claude

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = 'You are a job listing parser. Extract structured data from job posting text and return ONLY valid JSON with no preamble or markdown fences.'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url, text: pastedText } = req.body

  if (!url && !pastedText) {
    return res.status(400).json({ error: 'Either a URL or pasted text is required' })
  }

  let text

  try {
    if (pastedText) {
      // Paste mode — use the text directly, just clean up whitespace
      text = pastedText.replace(/\s+/g, ' ').trim().slice(0, 12000)
    } else {
      // URL mode — fetch and strip HTML
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      })

      if (!pageRes.ok) throw new Error(`Could not fetch URL (${pageRes.status}). Switch to "Paste text" mode and copy the job description instead.`)

      const html = await pageRes.text()

      text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 12000)
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{
        role: 'user',
        content: `Parse this job listing and extract structured data. Return ONLY a JSON object with these exact fields:

{
  "title": "job title",
  "company": "company name",
  "location": "location or Remote",
  "seniority_level": "one of: Junior, Mid, Senior, Staff, Lead, Principal, Director",
  "role_cluster": "one of: ux, product-design, design-engineer, design-technologist, other",
  "skills": ["array of specific skills, tools, technologies mentioned"],
  "requirements": ["array of required qualifications as short strings"],
  "nice_to_haves": ["array of preferred/bonus qualifications as short strings"],
  "salary_min": null or integer (USD annual equivalent — convert hourly × 2080, omit equity/bonus),
  "salary_max": null or integer (USD annual equivalent — convert hourly × 2080, omit equity/bonus),
  "raw_text": "first 2000 chars of cleaned job description text"
}

For salary: extract only base salary. If a range is given use both min and max. If only one number is stated, put it in salary_min. If no salary is mentioned, use null for both.

Job listing text:
${text}`
      }],
    })

    const responseText = message.content[0]?.type === 'text' ? message.content[0].text : '{}'

    let parsed
    try {
      parsed = JSON.parse(responseText.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      throw new Error('Failed to parse job listing. The page may require login or block automated access.')
    }

    res.json({
      title: parsed.title || null,
      company: parsed.company || null,
      location: parsed.location || null,
      seniority_level: parsed.seniority_level || null,
      role_cluster: parsed.role_cluster || 'other',
      skills: parsed.skills || [],
      requirements: parsed.requirements || [],
      nice_to_haves: parsed.nice_to_haves || [],
      salary_min: typeof parsed.salary_min === 'number' ? parsed.salary_min : null,
      salary_max: typeof parsed.salary_max === 'number' ? parsed.salary_max : null,
      raw_text: parsed.raw_text || text.slice(0, 2000),
    })

  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
