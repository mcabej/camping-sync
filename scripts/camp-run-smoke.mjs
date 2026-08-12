// The whole Camp round trip, with a stub standing in for the model: a message
// in the Planning Room, a tool call answered against the real database, the
// result fed back, and the reply saved as a durable message. lib/camp.js is
// checked on its own in camp-smoke.mjs; what is checked here is the wiring
// between it and the Responses API — the part that cannot be seen by reading
// either half.
import { spawn } from 'node:child_process'
import http from 'node:http'
import { rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { strict as assert } from 'node:assert'

const port = 33000 + (process.pid % 1000)
const path = `/tmp/camping-sync-camp-run-${process.pid}.db`
const origin = `http://127.0.0.1:${port}`

// A stub that always tries to write, whatever it was asked. Half of what is
// being tested is what happens when the model is wrong — or has been talked
// into it by something written on the trip — so it is scripted to reach for a
// tool on every turn and the server is expected to be the one saying no.
const asked = []
const sse = (res, events) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream' })
  events.forEach((event, i) => res.write(
    `event: ${event.type}\ndata: ${JSON.stringify({ ...event, sequence_number: i })}\n\n`))
  res.end()
}
const toolCall = (name, args) => ({
  type: 'function_call', id: `fc_${asked.length}`, call_id: `call_${asked.length}`,
  name, arguments: JSON.stringify(args),
})
const talks = (res, text) => sse(res, [
  ...[...text].map((ch) => ({ type: 'response.output_text.delta', delta: ch, item_id: 'msg_1', output_index: 0, content_index: 0 })),
  {
    type: 'response.completed',
    response: {
      id: `r${asked.length}`,
      status: 'completed',
      output: [{
        type: 'message', id: 'msg_1', role: 'assistant', status: 'completed',
        content: [{ type: 'output_text', text, annotations: [] }],
      }],
    },
  },
])
const callsTool = (res, call) => sse(res, [
  { type: 'response.completed', response: { id: `r${asked.length}`, status: 'completed', output: [call] } },
])

// The trip is made with a location and no map pin, so the forecast has to look
// the words up first. Both of those services stand in here too: the suite
// should not be traffic on somebody else's free tier, and a test that depends
// on what the weather is actually doing in Cumberland is not a test.
const json = (res, body) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}
const geocoded = [{
  place_id: 1, name: 'Wasdale Head', display_name: 'Wasdale Head, Cumberland, England',
  lat: '54.4667', lon: '-3.2833', address: { village: 'Wasdale Head', country: 'England' },
}]
const forecastDays = {
  time: ['2026-08-14', '2026-08-15', '2026-08-16'],
  weather_code: [3, 61, 80],
  temperature_2m_max: [19.2, 15.4, 16.1],
  temperature_2m_min: [11.0, 9.8, 10.2],
  precipitation_sum: [0.2, 14.6, 3.1],
  precipitation_probability_max: [15, 90, 55],
  wind_speed_10m_max: [12, 34, 22],
}

// What the stub does next, set by each part of the test before it sends.
let script = () => null
const model = http.createServer((req, res) => {
  if (req.url.startsWith('/search')) return json(res, geocoded)
  if (req.url.startsWith('/forecast')) return json(res, { daily: forecastDays })
  let raw = ''
  req.on('data', (chunk) => { raw += chunk })
  req.on('end', () => {
    asked.push(JSON.parse(raw))
    script(res, asked[asked.length - 1])
  })
})
await new Promise((resolve) => model.listen(0, '127.0.0.1', resolve))

const server = spawn(process.execPath, ['server.js'], {
  env: {
    ...process.env,
    PORT: String(port), DB_PATH: path, NODE_ENV: 'test', DEV_AUTH_BYPASS: '1',
    GOOGLE_CLIENT_ID: '',
    OPENAI_API_KEY: 'stub-key',
    OPENAI_BASE_URL: `http://127.0.0.1:${model.address().port}/v1`,
    PLACES_URL: `http://127.0.0.1:${model.address().port}/search`,
    WEATHER_URL: `http://127.0.0.1:${model.address().port}/forecast`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (chunk) => { if (String(chunk).includes('listening')) resolve() })
    server.once('exit', (code) => reject(new Error(`test server exited ${code}`)))
  })

  const jar = []
  const api = async (route, body, method = 'POST') => {
    const response = await fetch(origin + route, {
      method,
      headers: { origin, 'content-type': 'application/json', cookie: jar.join('; ') },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    for (const cookie of response.headers.getSetCookie?.() ?? []) jar.push(cookie.split(';')[0])
    const text = await response.text()
    return { status: response.status, body: text ? JSON.parse(text) : null }
  }

  const signedIn = await api('/api/auth/dev', { devId: 'campsmoke1234' })
  assert.equal(signedIn.status, 200)
  const trip = await api('/api/trips', {
    name: 'Wasdale', organiser: 'Sam', location: 'Wasdale Head',
    start_date: '2026-08-14', end_date: '2026-08-16',
  })
  const tripId = trip.body.trip.id

  const db = new DatabaseSync(path, { readOnly: true })
  let said = 0
  const waitForReply = async () => {
    for (let i = 0; i < 100; i++) {
      const rows = db.prepare("SELECT body FROM messages WHERE role = 'assistant' ORDER BY id").all()
      if (rows.length > said) { said = rows.length; return rows[rows.length - 1].body }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return null
  }
  const ask = async (text, clientId, replyTo = null) => {
    const sent = await api(`/api/trips/${tripId}/messages`, { text, clientId, replyTo })
    assert.equal(sent.body.assistant?.status, 'queued', JSON.stringify(sent.body))
    return waitForReply()
  }

  // ---- a request to change something --------------------------------------------

  const added = 'Added a tarp to the gear list and put you down for it.'
  script = (res) => (asked.length === 1
    ? callsTool(res, toolCall('add_items', {
      items: [{
        list: 'gear', title: 'Tarp', category: 'Shelter & sleep', qty: null, note: null,
        kind: 'shared', day: null, time: null, place: null, broughtBy: 'me',
      }],
    }))
    : talks(res, added))
  assert.equal(await ask('@camp add a tarp for me', 'c1'), added)

  const tarp = db.prepare("SELECT id FROM items WHERE title = 'Tarp'").get()
  assert.ok(tarp, 'the tool call did not add the item')
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM claims WHERE item_id = ?').get(tarp.id).n, 1)
  assert.ok(db.prepare("SELECT 1 FROM events WHERE actor = 'Camp' AND text = 'added Tarp'").get(),
    'Camp signed its work with somebody else\'s name')

  const [first, second] = asked
  assert.equal(first.input.length, 2)
  assert.ok(first.input[0].content.startsWith('Trip snapshot as JSON'))
  assert.ok(first.input[1].content.includes('@camp add a tarp for me'))
  assert.ok(first.tools.length >= 10, 'the model was offered no tools')
  assert.ok(second.input.some((turn) => turn.type === 'function_call_output'),
    'the tool result was never fed back')

  // ---- a question, answered by a model that tries to write anyway -----------------

  const dodged = 'You have a tarp and a four-person tent. Nobody has claimed the stove.'
  script = (res, request) => (request.input.some((turn) => turn.type === 'function_call_output')
    ? talks(res, dodged)
    : callsTool(res, toolCall('record_payment', { from: 'Sam', to: 'Sam', amount: '500.00', note: null })))
  assert.equal(await ask('@camp what have we got so far?', 'c2'), dodged)

  // Nothing was written, and the model was never given the means: the request
  // for a question carries no tools at all.
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payments').get().n, 0)
  const question = asked[2]
  assert.equal(question.tools, undefined, 'a question was sent tools')
  assert.ok(asked[3].input.some((turn) => turn.type === 'function_call_output'
    && turn.output.includes('no tools this turn')), 'the invented tool call was not refused')

  // ---- the forecast, and what happened lately ---------------------------------------

  {
    // Both of these reach the model in the snapshot rather than behind a tool
    // call, so what is checked is that they are in the request at all.
    const snapshot = JSON.parse(asked[2].input[0].content.replace(/^[^{]*/, ''))
    assert.ok(snapshot.weather?.days?.length, 'no forecast was sent')
    // The trip has no map pin, so the pin was looked up from its own words —
    // and the answer says so, because a guessed place is worth a caveat.
    assert.ok(snapshot.weather.lookedUpFrom.includes('Wasdale Head'))
    assert.equal(snapshot.weather.days[1].pop, 90)
    // Wet Saturday, and the catalogue things that answer it, so "it is going to
    // rain" can become "shall I add a tarp?".
    assert.ok(snapshot.weather.advice.some((tip) => tip.gear.includes('Tarp')),
      `no tarp in ${JSON.stringify(snapshot.weather.advice)}`)

    assert.deepEqual(snapshot.recentChanges.map((change) => change.did).slice(0, 2),
      ['put Sam down for Tarp', 'added Tarp'])
    assert.equal(snapshot.recentChanges.at(-1).did, 'started the trip')
  }

  // ---- deleting, proposed and then confirmed --------------------------------------

  const proposed = 'That would remove Tarp. Confirm and I will do it.'
  script = (res, request) => (request.input.some((turn) => turn.type === 'function_call_output')
    ? talks(res, proposed)
    : callsTool(res, toolCall('remove_items', { refs: ['i1'] })))
  assert.equal(await ask('@camp delete the tarp', 'c3'), proposed)
  assert.ok(db.prepare("SELECT 1 FROM items WHERE title = 'Tarp'").get(),
    'the proposal deleted something on its own')

  const confirmed = 'Deleted the tarp.'
  script = (res) => talks(res, confirmed)
  assert.equal(await ask('@camp how many confirmation do you need yes do it', 'c4'), confirmed)
  assert.ok(!db.prepare("SELECT 1 FROM items WHERE title = 'Tarp'").get(), 'the yes did not delete it')
  // The deletion happened before the model was called, and it was told so.
  const afterYes = asked[asked.length - 1]
  assert.ok(afterYes.input.some((turn) => String(turn.content ?? '').includes('already been carried out')))
  assert.equal(afterYes.tools, undefined, 'a confirmation turn was sent tools')

  // ---- replying to Camp, which is a question without the handle -------------------

  {
    // "Are you sure?" under an answer is addressed to whoever gave the answer.
    // The room can see that, and so can the route: no @camp anywhere in it.
    const lastCamp = db.prepare("SELECT id FROM messages WHERE role = 'assistant' ORDER BY id DESC LIMIT 1").get()
    const sure = 'Yes — the tarp is gone. Say the word and I will put it back.'
    script = (res) => talks(res, sure)
    assert.equal(await ask('are you sure that was the right one?', 'c5', lastCamp.id), sure)

    // And it arrives attached to what it doubts, rather than leaving the model
    // to work out which of thirty messages "that" was.
    const followUp = asked[asked.length - 1].input[1].content
    assert.ok(followUp.includes('replied'), followUp)
    assert.ok(followUp.includes('a message of yours'), followUp)
    assert.ok(followUp.includes('Deleted the tarp.'), followUp)
    assert.ok(followUp.includes('are you sure that was the right one?'), followUp)

    // The answer quotes the question it answers, so the room can read the pair.
    const answer = db.prepare("SELECT reply_to FROM messages WHERE role = 'assistant' ORDER BY id DESC LIMIT 1").get()
    const question = db.prepare('SELECT id FROM messages WHERE client_id = ?').get('c5')
    assert.equal(answer.reply_to, question.id)
  }

  {
    // A reply to a person is not a question for Camp. Nothing is queued, and
    // the model is not called at all.
    const runs = asked.length
    const person = db.prepare('SELECT id FROM messages WHERE client_id = ?').get('c5')
    const sent = await api(`/api/trips/${tripId}/messages`, {
      text: 'good, that was the one I meant', clientId: 'c6', replyTo: person.id,
    })
    assert.equal(sent.status, 201)
    assert.equal(sent.body.assistant, null, JSON.stringify(sent.body))
    assert.equal(sent.body.message.reply.id, person.id)
    await new Promise((resolve) => setTimeout(resolve, 200))
    assert.equal(asked.length, runs, 'a reply to a member woke the assistant')
  }

  db.close()
  console.log('camp round-trip smoke passed')
} finally {
  server.kill()
  model.close()
  for (const suffix of ['', '-shm', '-wal']) rmSync(`${path}${suffix}`, { force: true })
}
