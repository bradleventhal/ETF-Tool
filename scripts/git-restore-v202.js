import { execFileSync } from 'child_process'
import { existsSync, writeFileSync, mkdirSync } from 'fs'

const GIT = '/usr/bin/git'
const CWD = '/vercel/share/v0-project'

function git(...args) {
  try {
    return execFileSync(GIT, args, { encoding: 'utf-8', cwd: CWD, timeout: 30000 })
  } catch(e) {
    console.log(`git ${args.join(' ')} failed:`, e.stderr || e.message)
    return null
  }
}

// First, initialize git if needed
if (!existsSync('/vercel/share/v0-project/.git')) {
  console.log('No .git directory, trying to init and fetch...')
  git('init')
  git('remote', 'add', 'origin', 'https://github.com/bradleventhal/ETF-Tool.git')
  // Try fetching - this will likely fail without auth
  const result = git('fetch', 'origin', 'v0/bradleventhal123-7410-793cca58')
  if (!result && result !== '') {
    console.log('Cannot fetch without auth token')
    
    // Alternative: try git log if repo was already initialized
    const log = git('log', '--oneline', '-5')
    console.log('git log:', log)
  }
} else {
  // .git exists, try to get V202
  console.log('Found .git, checking log...')
  const log = git('log', '--oneline', '-30')
  console.log('Recent commits:\n', log)
  
  // Try to show files at commit 5b3e6d6
  const files = ['app/page.tsx', 'components/fund-universe-map.tsx', 'components/fund-lookup.tsx']
  for (const f of files) {
    const content = git('show', '5b3e6d6:' + f)
    if (content) {
      const outPath = `/vercel/share/v0-project/scripts/v202_${f.replace(/\//g, '_')}`
      writeFileSync(outPath, content)
      console.log(`Restored ${f}: ${content.length} chars`)
    }
  }
}
