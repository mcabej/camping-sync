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

  // The reminders belong to the account and to no trip in particular, so they
  // are written without one. Two switches, because three days out is about the
  // group's list and the morning of is about your own: one answer must not be
  // read as the other, and neither is touched by muting a room.
  assert.deepEqual(alerts.reminders, { lead: false, morning: false })
  const reminding = await (await request('/notifications', first.cookie, 'PATCH', { lead: true })).json()
  assert.deepEqual(reminding.reminders, { lead: true, morning: false })
  const remindingAlerts = await (await request('/notifications', first.cookie)).json()
  assert.deepEqual(remindingAlerts.reminders, { lead: true, morning: false })
  assert.equal(remindingAlerts.trips[0].muted, true)
  // One person's answer is one person's: the other account is untouched.
  assert.deepEqual((await (await request('/notifications', second.cookie)).json()).reminders,
    { lead: false, morning: false })

  const both = await (await request('/notifications', first.cookie, 'PATCH',
    { lead: false, morning: true })).json()
  assert.deepEqual(both.reminders, { lead: false, morning: true })

  // A body carrying neither switch is a request that means nothing, rather than
  // one that means "leave both as they are".
  assert.equal((await request('/notifications', first.cookie, 'PATCH', { muted: true })).status, 400)
  assert.equal((await request('/notifications', first.cookie, 'PATCH', { morning: 'yes' })).status, 400)
  assert.equal((await fetch(`${origin}/api/notifications`, {
    method: 'PATCH', headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ lead: true }),
  })).status, 401)

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

  // ---- the pin, of which there is one -------------------------------------------

  {
    const pin = (cookie, messageId) => request(
      `/trips/${created.trip.id}/pin`, cookie, 'PUT', { messageId },
    )
    const firstMessage = quiet.message.id
    const secondMessage = (await say('pin-target', {
      text: 'Saturday morning it is, then',
    })).message.id

    // Nothing is pinned until somebody pins something.
    const before = await (await request(`/trips/${created.trip.id}`, first.cookie)).json()
    assert.equal(before.pinned, null)

    const pinned = await (await pin(first.cookie, firstMessage)).json()
    assert.equal(pinned.pinned.id, firstMessage)
    assert.equal(pinned.pinned.author, 'Driver')
    assert.equal(pinned.pinned.assistant, false)
    assert.equal(pinned.pinned.body, '@camp add a tarp to the gear list')
    assert.ok(pinned.trip.rev > before.trip.rev, 'pinning did not move the trip on')
    assert.equal(pinned.events[0].text, 'pinned “@camp add a tarp to the gear list”',
      JSON.stringify(pinned.events[0]))
    assert.equal(pinned.events[0].actor, 'Driver')

    // Pinning a second message does not give the trip two. It replaces, and the
    // feed says what it cost so the person who pinned the first one can see
    // where it went.
    const swapped = await (await pin(second.cookie, secondMessage)).json()
    assert.equal(swapped.pinned.id, secondMessage)
    assert.equal(swapped.events[0].actor, 'Passenger')
    assert.ok(swapped.events[0].text.startsWith('replaced the pin '), swapped.events[0].text)
    assert.ok(swapped.events[0].text.includes('“Saturday morning it is, then”'), swapped.events[0].text)

    // Pinning what is already pinned changed nothing, so it is not something
    // that happened: no second feed line, and the trip does not move on.
    const again = await (await pin(first.cookie, secondMessage)).json()
    assert.equal(again.trip.rev, swapped.trip.rev)
    assert.equal(again.events.length, swapped.events.length)

    // Naming a message from another trip is how a pin would become a way to
    // read that trip, so it is looked up in this one and simply not found.
    const elsewhere = await request('/trips', second.cookie, 'POST', { name: 'Another', organiser: 'Nobody' })
    const otherTrip = (await elsewhere.json()).trip.id
    const foreign = (await (await request(`/trips/${otherTrip}/messages`, second.cookie, 'POST',
      { clientId: 'far-away', text: 'Private plans' })).json()).message.id
    assert.equal((await pin(first.cookie, foreign)).status, 400)
    assert.equal((await pin(first.cookie, 0)).status, 400)
    assert.equal((await pin(first.cookie, 'seven')).status, 400)

    // Null is the way back to nothing pinned. There is no "unpin that one",
    // because there is only ever one.
    const cleared = await (await pin(first.cookie, null)).json()
    assert.equal(cleared.pinned, null)
    assert.ok(cleared.events[0].text.startsWith('unpinned '), cleared.events[0].text)

    // The room is the trip's, and so is the pin: a stranger with the link can
    // neither set one nor be the one who did.
    assert.equal((await fetch(`${origin}/api/trips/${created.trip.id}/pin`, {
      method: 'PUT',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ messageId: secondMessage }),
    })).status, 401)
  }

  console.log('development auth smoke passed')
} finally {
  if (server.exitCode === null) {
    server.kill()
    await once(server, 'exit')
  }
  for (const suffix of ['', '-shm', '-wal']) rmSync(`${path}${suffix}`, { force: true })
}
