// Lance le serveur (port 3000) et le client Vite (port 5173) ensemble.
// Usage : npm run dev
import { spawn } from 'node:child_process'

const procs = [
  { name: 'serveur', color: '\x1b[32m', cmd: 'npm', args: ['run', 'dev', '-w', 'server'] },
  { name: 'client ', color: '\x1b[36m', cmd: 'npm', args: ['run', 'dev', '-w', 'client'] },
]

const children = procs.map(({ name, color, cmd, args }) => {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  const prefix = `${color}[${name}]\x1b[0m `
  const pipe = stream => {
    let buffer = ''
    stream.on('data', chunk => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) console.log(prefix + line)
    })
  }
  pipe(child.stdout)
  pipe(child.stderr)
  child.on('exit', code => {
    console.log(`${prefix}terminé (${code})`)
    process.exit(code ?? 0)
  })
  return child
})

process.on('SIGINT', () => {
  for (const child of children) child.kill('SIGINT')
})
