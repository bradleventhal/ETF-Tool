export async function GET() {
  const key = (process.env.OPENAI_API_KEY || '').trim()

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello in 3 words' }],
      max_tokens: 10,
    }),
  })

  const body = await res.json()

  return Response.json({
    keyPresent: !!key,
    keyLength: key.length,
    status: res.status,
    working: res.ok,
    response: res.ok ? body.choices?.[0]?.message?.content : body.error?.message,
  })
}
