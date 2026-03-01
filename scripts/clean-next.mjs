import fs from 'node:fs'
import path from 'node:path'

const nextDir = path.resolve(process.cwd(), '.next')

try {
  fs.rmSync(nextDir, { recursive: true, force: true })
} catch {}
