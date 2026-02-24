import { execSync } from 'child_process'
import { existsSync, readdirSync } from 'fs'

// Check if .git exists
console.log('.git exists:', existsSync('/vercel/share/v0-project/.git'))
if (existsSync('/vercel/share/v0-project/.git')) {
  console.log('.git contents:', readdirSync('/vercel/share/v0-project/.git'))
}

// Try to find git binary
const paths = ['/usr/bin/git', '/usr/local/bin/git', '/bin/git']
for (const p of paths) {
  console.log(`${p} exists:`, existsSync(p))
}

// Try which git
try {
  const result = execSync('which git 2>&1 || echo "not found"', { encoding: 'utf-8' })
  console.log('which git:', result.trim())
} catch(e) {
  console.log('which git error:', e.message)
}

// Try running git
try {
  const result = execSync('git --version 2>&1', { encoding: 'utf-8', cwd: '/vercel/share/v0-project' })
  console.log('git version:', result.trim())
} catch(e) {
  console.log('git error:', e.message)
}

// Try git log if git works
try {
  const result = execSync('git log --oneline -30 2>&1', { encoding: 'utf-8', cwd: '/vercel/share/v0-project' })
  console.log('git log:\n', result)
} catch(e) {
  console.log('git log error:', e.message)
}
