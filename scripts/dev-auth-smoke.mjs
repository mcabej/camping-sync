import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { rmSync } from 'node:fs'
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
  console.log('development auth smoke passed')
} finally {
  if (server.exitCode === null) {
    server.kill()
    await once(server, 'exit')
  }
  for (const suffix of ['', '-shm', '-wal']) rmSync(`${path}${suffix}`, { force: true })
}
