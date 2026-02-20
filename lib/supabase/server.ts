import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export function createClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      `Missing Supabase env vars. URL: ${url ? "set" : "MISSING"}, KEY: ${key ? "set" : "MISSING"}. ` +
      `Available vars: ${Object.keys(process.env).filter(k => k.includes("SUPABASE")).join(", ")}`
    )
  }
  return createSupabaseClient(url, key)
}
