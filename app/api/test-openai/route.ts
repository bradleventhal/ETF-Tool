export async function GET() {
  const key = (process.env.OPENAI_API_KEY || '').trim()

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say hello in 3 words' }],
      max_tokens: 20,
    }),
  })

  const body = await res.text()

  return Response.json({
    keyPresent: !!key,
    keyLength: key.length,
    keyPrefix: key.substring(0, 10),
    keySuffix: key.substring(key.length - 5),
    status: res.status,
    response: body,
  })
}
