import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export function createClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yrbenqysbysfmyagborb.supabase.co"
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyYmVucXlzYnlzZm15YWdib3JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTkzMjYsImV4cCI6MjA4NzEzNTMyNn0._Obh7D7c__kH7J1CPWjWR1QGRz_bE_3FlLH5Hh6Pnp0"
  return createSupabaseClient(url, key)
}
