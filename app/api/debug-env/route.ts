import { NextResponse } from "next/server"

export async function GET() {
  const key = process.env.OPENAI_API_KEY
  return NextResponse.json({
    hasKey: !!key,
    keyLength: key?.length ?? 0,
    keyPrefix: key ? key.substring(0, 7) + "..." : "NOT SET",
    allEnvKeys: Object.keys(process.env).filter(k => 
      k.includes("OPENAI") || k.includes("SUPABASE") || k.includes("NEXT_PUBLIC")
    ),
  })
}
