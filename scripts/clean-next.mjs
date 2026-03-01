import fs from 'node:fs'
import path from 'node:path'

// Skip cleaning .next on Vercel (it handles its own cache)
if (process.env.VERCEL || process.env.CI) process.exit(0)

const nextDir = path.resolve(process.cwd(), '.next')

try {
  fs.rmSync(nextDir, { recursive: true, force: true })
} catch {}
