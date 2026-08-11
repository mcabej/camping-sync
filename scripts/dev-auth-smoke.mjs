import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { strict as assert } from 'node:assert'

const port = 32000 + (process.pid % 1000)
const path = `/tmp/camping-sync-dev-auth-${process.pid}.db`
const origin = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ['server.js'], {
  env: {
    ...process.env,
    PORT: String(port), DB_PATH: path, NODE_ENV: 'test', DEV_AUTH_BYPASS: '1',
    GOOGLE_CLIENT_ID: '', OPENAI_API_KEY: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('listening')) resolve()
    })
    server.once('exit', (code) => reject(new Error(`test server exited ${code}`)))
  })

  const signIn = async (devId) => {
    const response = await fetch(`${origin}/api/auth/dev`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ devId, legacyMemberships: [] }),
    })
    assert.equal(response.status, 200)
    return {
      data: await response.json(),
      cookie: response.headers.get('set-cookie').split(';', 1)[0],
    }
  }

  const request = async (path, cookie, method = 'GET', body) => fetch(`${origin}/api${path}`, {
    method,
    headers: { origin, cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })

  const first = await signIn('browser-a')
  const second = await signIn('browser-b')
  const returning = await signIn('browser-a')
  assert.notEqual(first.data.user.id, second.data.user.id)
  assert.equal(first.data.user.id, returning.data.user.id)

  const createdResponse = await request('/trips', first.cookie, 'POST', {
    name: 'Petrol test', organiser: 'Driver', currency: 'GBP',
  })
  assert.equal(createdResponse.status, 200)
  const created = await createdResponse.json()
  const joinedResponse = await request(`/trips/${created.trip.id}/members`, second.cookie, 'POST', {
    name: 'Passenger', self: true,
  })
  assert.equal(joinedResponse.status, 200)
  const joined = await joinedResponse.json()

  const petrolResponse = await request(`/trips/${created.trip.id}/expenses`, first.cookie, 'POST', {
    description: 'Petrol', amount: '60.00', paidBy: created.memberId,
    participants: [created.memberId, joined.member.id],
  })
  assert.equal(petrolResponse.status, 201)
  const petrolState = await petrolResponse.json()
  assert.deepEqual(petrolState.expenses.map(({ description, amount, paid_by, participants }) => (
    { description, amount, paid_by, participants }
  )), [{
    description: 'Petrol', amount: 6000, paid_by: created.memberId,
    participants: [created.memberId, joined.member.id],
  }])
  assert.equal(petrolState.expenses[0].shares, null)

  const mealResponse = await request(`/trips/${created.trip.id}/expenses`, first.cookie, 'POST', {
    description: 'Meal', amount: '20.00', paidBy: created.memberId,
    participants: [created.memberId, joined.member.id], split: 'custom',
    shares: { [created.memberId]: '8.00', [joined.member.id]: '12.00' },
  })
  assert.equal(mealResponse.status, 201)
  const mealState = await mealResponse.json()
  assert.deepEqual(mealState.expenses.find((expense) => expense.description === 'Meal').shares, {
    [created.memberId]: 800,
    [joined.member.id]: 1200,
  })

  const badSplitResponse = await request(`/trips/${created.trip.id}/expenses`, first.cookie, 'POST', {
    description: 'Bad meal', amount: '20.00', paidBy: created.memberId,
    participants: [created.memberId, joined.member.id], split: 'custom',
    shares: { [created.memberId]: '8.00', [joined.member.id]: '11.00' },
  })
  assert.equal(badSplitResponse.status, 400)

  const itemResponse = await request(`/trips/${created.trip.id}/items`, first.cookie, 'POST', {
    list: 'gear', category: 'Camp kitchen', title: 'Firewood', kind: 'shared',
  })
  assert.equal(itemResponse.status, 200)
  const itemState = await itemResponse.json()
  const firewood = itemState.items.find((item) => item.title === 'Firewood')
  const claimResponse = await request(`/items/${firewood.id}/claim`, first.cookie, 'POST', {
    memberId: created.memberId,
  })
  assert.equal(claimResponse.status, 200)
  const firewoodResponse = await request(`/trips/${created.trip.id}/expenses`, first.cookie, 'POST', {
    description: 'Firewood', amount: '20.00', paidBy: created.memberId,
    participants: [created.memberId, joined.member.id],
    itemId: firewood.id, claimMemberId: created.memberId,
  })
  assert.equal(firewoodResponse.status, 201)
  const firewoodState = await firewoodResponse.json()
  assert.equal(firewoodState.expenses.find((expense) => expense.description === 'Firewood').item_id, firewood.id)

  const anonymousState = await (await fetch(`${origin}/api/trips/${created.trip.id}`)).json()
  assert.deepEqual(anonymousState.expenses, [])

  const outsiderResponse = await request(`/trips/${created.trip.id}/expenses`, first.cookie, 'POST', {
    description: 'Not allowed', amount: '1.00', paidBy: created.memberId,
    participants: ['not-on-this-trip'],
  })
  assert.equal(outsiderResponse.status, 400)

  // The settings page reads every trip's alerts in one answer. It takes no trip
  // id, so the thing worth proving is that it hands back the memberships the
  // session owns and nobody else's — and that muting from there is the same row
  // the bell in the Planning Room writes.
  assert.equal((await fetch(`${origin}/api/notifications`)).status, 401)

  const alertsResponse = await request('/notifications', first.cookie)
  assert.equal(alertsResponse.status, 200)
  const alerts = await alertsResponse.json()
  assert.deepEqual(alerts.trips.map((trip) => trip.tripId), [created.trip.id])
  assert.equal(alerts.trips[0].name, 'Petrol test')
  assert.equal(alerts.trips[0].muted, false)
  assert.ok(alerts.publicKey)

  const secondAlerts = await (await request('/notifications', second.cookie)).json()
  assert.deepEqual(secondAlerts.trips.map((trip) => trip.tripId), [created.trip.id])

  await request(`/trips/${created.trip.id}/notifications`, first.cookie, 'PATCH', { muted: true })
  const mutedAlerts = await (await request('/notifications', first.cookie)).json()
  assert.equal(mutedAlerts.trips[0].muted, true)
  // One person muting a trip does not mute it for the rest of them.
  const otherAlerts = await (await request('/notifications', second.cookie)).json()
  assert.equal(otherAlerts.trips[0].muted, false)

  // A face belongs to the people on the trip. The development sign-in has no
  // picture to hand — Google is where they come from — so one is written onto
  // the row directly: what is being tested is not where it came from but who it
  // is given to.
  const side = new DatabaseSync(path)
  side.prepare('UPDATE users SET picture = ? WHERE id = ?')
    .run('https://lh3.example/face.png', first.data.user.id)
  side.close()

  const asMember = await (await request(`/trips/${created.trip.id}`, first.cookie)).json()
  assert.equal(asMember.members.find((m) => m.id === created.memberId).picture,
    'https://lh3.example/face.png')

  // A trip link travels further than it was meant to. A name is what the
  // invitation is about; a row of photographs of strangers is not, so it waits
  // behind the same door the ledger does.
  const asStranger = await (await fetch(`${origin}/api/trips/${created.trip.id}`)).json()
  assert.deepEqual(asStranger.members.map((m) => m.picture), ['', ''])
  assert.deepEqual(asStranger.members.map((m) => m.name), ['Driver', 'Passenger'])

  // Camp switched off in settings is a promise about the room, and the half of
  // it that matters is here: hiding the placeholder still left @camp summoning
  // an assistant the person had turned off. `unavailable` is this test server
  // having no key — the point is that the first message reaches that decision at
  // all and the second never gets near it, so it is saved as ordinary talk.
  const say = async (clientId, extra) => (await request(
    `/trips/${created.trip.id}/messages`, first.cookie, 'POST',
    { clientId, text: '@camp add a tarp to the gear list', ...extra },
  )).json()

  assert.deepEqual((await say('camp-on')).assistant, { status: 'unavailable' })
  const quiet = await say('camp-off', { invokeAssistant: false })
  assert.equal(quiet.assistant, null)
  assert.equal(quiet.message.body, '@camp add a tarp to the gear list')
  assert.equal(quiet.message.role, 'member')

  console.log('development auth smoke passed')
} finally {
  if (server.exitCode === null) {
    server.kill()
    await once(server, 'exit')
  }
  for (const suffix of ['', '-shm', '-wal']) rmSync(`${path}${suffix}`, { force: true })
}
