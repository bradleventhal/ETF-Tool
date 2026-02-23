export async function GET() {
  const allKeys = Object.keys(process.env).sort()
  const openaiKey = process.env.OPENAI_API_KEY || ''
  const matchingKeys = allKeys.filter(k => k.toUpperCase().includes('OPENAI') || k.toUpperCase().includes('API_KEY'))

  return Response.json({
    openaiKeyPresent: !!openaiKey,
    openaiKeyLength: openaiKey.length,
    matchingEnvVarNames: matchingKeys,
    totalEnvVars: allKeys.length,
    allEnvKeys: allKeys,
  })
}
