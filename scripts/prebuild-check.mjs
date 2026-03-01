import net from 'node:net'

const PORT = Number(process.env.NEXT_DEV_PORT || 3000)

const server = net.createServer()
server.unref()

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`[prebuild] Port ${PORT} is in use. Stop \`next dev\` before running \`next build\` to avoid corrupting .next.`)
    process.exit(1)
  }
  console.error('[prebuild] Unexpected error:', err)
  process.exit(1)
})

server.listen(PORT, '0.0.0.0', () => {
  server.close(() => process.exit(0))
})
