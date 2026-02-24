import { readFileSync, writeFileSync, existsSync } from 'fs'

// Try to find a GitHub token
const possibleEnvVars = ['GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_ACCESS_TOKEN', 'VERCEL_GIT_PROVIDER_TOKEN']
let token = null
for (const key of possibleEnvVars) {
  if (process.env[key]) {
    token = process.env[key]
    console.log(`Found token in ${key}`)
    break
  }
}

// Also check .git/config or other config files for tokens
const envKeys = Object.keys(process.env).filter(k => k.includes('GIT') || k.includes('GITHUB') || k.includes('TOKEN'))
console.log('Available env vars with GIT/GITHUB/TOKEN:', envKeys)

if (!token) {
  console.log('No GitHub token found. Listing all env vars for debugging:')
  console.log(Object.keys(process.env).join(', '))
}

const COMMIT = '5b3e6d6'
const REPO = 'bradleventhal/ETF-Tool'
const FILES = [
  'app/page.tsx',
  'components/fund-universe-map.tsx',
  'components/fund-lookup.tsx'
]

async function fetchFile(path) {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${COMMIT}`
  const headers = { 'Accept': 'application/vnd.github.v3.raw', 'User-Agent': 'v0-restore' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  
  try {
    const res = await fetch(url, { headers })
    if (!res.ok) {
      console.log(`Failed to fetch ${path}: ${res.status} ${res.statusText}`)
      return null
    }
    const content = await res.text()
    console.log(`Fetched ${path}: ${content.length} chars`)
    return content
  } catch (e) {
    console.log(`Error fetching ${path}: ${e.message}`)
    return null
  }
}

async function main() {
  for (const file of FILES) {
    const content = await fetchFile(file)
    if (content) {
      const outPath = `/vercel/share/v0-project/scripts/v202_${file.replace(/\//g, '_')}`
      writeFileSync(outPath, content)
      console.log(`Saved to ${outPath}`)
    }
  }
}

main()
