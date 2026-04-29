// api/fetch-listing.js
// Vercel serverless function — fetches a job URL OR parses pasted text via Claude

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

    // Use Claude to parse the listing
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: `You are a job listing parser. Extract structured data from job posting text and return ONLY valid JSON with no preamble or markdown fences.`,
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
  "raw_text": "first 2000 chars of cleaned job description text"
}

Job listing text:
${text}`
        }]
      })
    })

    const claudeData = await claudeRes.json()
    const responseText = claudeData.content?.[0]?.text || '{}'
    
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
      raw_text: parsed.raw_text || text.slice(0, 2000),
    })

  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
