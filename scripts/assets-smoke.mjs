// What comes back for the files a phone downloads: the encoding the client
// actually asked for, and a cache lifetime that matches how the URL was named.
// Both are the kind of thing that is invisible until a browser is sitting on a
// week-old app, or a proxy hands somebody a brotli body they cannot read.
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { strict as assert } from 'node:assert'

const port = 34000 + (process.pid % 1000)
const path = `/tmp/camping-sync-assets-${process.pid}.db`
const origin = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ['server.js'], {
  env: {
    ...process.env,
    PORT: String(port), DB_PATH: path, NODE_ENV: 'test',
    GOOGLE_CLIENT_ID: '', OPENAI_API_KEY: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (chunk) => { if (String(chunk).includes('listening')) resolve() })
    server.once('exit', (code) => reject(new Error(`test server exited ${code}`)))
  })

  const head = async (route, encodings) => {
    const response = await fetch(origin + route, {
      headers: encodings === null ? {} : { 'accept-encoding': encodings },
    })
    return {
      encoding: response.headers.get('content-encoding'),
      cache: response.headers.get('cache-control'),
      vary: response.headers.get('vary'),
      body: await response.text(),
    }
  }

  // A weight of zero is a client saying it will not take that encoding. It is
  // the case a substring match cannot see, and both directions are checked.
  assert.equal((await head('/app.js', 'gzip;q=0')).encoding, null)
  assert.equal((await head('/app.js', 'br;q=0, gzip;q=1')).encoding, 'gzip')
  assert.equal((await head('/app.js', 'identity')).encoding, null)
  // Offered both as equals, the smaller one wins.
  assert.equal((await head('/app.js', 'gzip, deflate, br')).encoding, 'br')
  assert.ok((await head('/app.js', 'gzip')).vary?.includes('Accept-Encoding'))

  // The name with the right hash on it is the one that can be kept for a year.
  // The bare name is whatever is deployed now, so it has to be asked about.
  const index = await head('/', 'gzip')
  const version = index.body.match(/app\.js\?v=([a-f0-9]+)/)?.[1]
  assert.ok(version, 'index.html carries no hashed app.js')
  assert.equal(index.cache, 'no-cache')
  assert.equal((await head(`/app.js?v=${version}`, 'gzip')).cache, 'public, max-age=31536000, immutable')
  assert.equal((await head('/app.js', 'gzip')).cache, 'no-cache')
  assert.equal((await head('/app.js?v=deadbeef', 'gzip')).cache, 'no-cache')

  // The JSON path is answered the same way, and is not compressed for a client
  // that has said it does not want it.
  assert.equal((await head('/api/catalog', 'gzip;q=0')).encoding, null)
  assert.equal((await head('/api/catalog', 'gzip')).encoding, 'gzip')

  console.log('asset delivery smoke passed')
} finally {
  server.kill()
  for (const suffix of ['', '-shm', '-wal']) rmSync(`${path}${suffix}`, { force: true })
}
