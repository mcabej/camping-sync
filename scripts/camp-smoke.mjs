// What Camp can see and what Camp can do to a trip, checked without an API key
// anywhere near it. The model's judgement is not testable here; the boundary
// around it is, and the boundary is the part that matters — a snapshot that
// leaks somebody's private kit, or a tool that deletes things nobody asked to
// delete, would both be quiet failures in production.
import { rmSync } from 'node:fs'
import { strict as assert } from 'node:assert'

const path = `/tmp/camping-sync-camp-${process.pid}.db`
process.env.DB_PATH = path

try {
  const { db, now } = await import('../lib/db.js')
  const {
    campSnapshot, campContext, campWriteIntent, campConfirmIntent, runCampTool, CAMP_LIMITS,
    campStagedRemoval, clearCampStagedRemoval, applyCampStagedRemoval, asksCamp,
  } = await import('../lib/camp.js')

  const ts = now()
  db.prepare(`INSERT INTO trips (id, name, location, lat, lon, start_date, end_date, notes, currency, created_at)
              VALUES ('trip', 'Wasdale', 'Wasdale Head', 54.4, -3.3, '2026-08-14', '2026-08-16', 'Gate code 1470.', 'GBP', ?)`).run(ts)
  const member = db.prepare(`INSERT INTO members (id, trip_id, name, diet, created_at) VALUES (?, 'trip', ?, ?, ?)`)
  member.run('sam', 'Sam', 'no nuts', ts)
  member.run('alex', 'Alex', '', ts)

  const item = db.prepare(`INSERT INTO items (id, trip_id, list, category, title, kind, owner_id, day, created_at, updated_at)
                           VALUES (?, 'trip', ?, ?, ?, ?, ?, ?, ?, ?)`)
  item.run('tent', 'gear', 'Shelter & sleep', 'Four-person tent', 'shared', null, '', ts, ts)
  item.run('chilli', 'food', 'Dinner', 'Chilli', 'shared', null, '2026-08-14', ts, ts)
  item.run('sams-bag', 'gear', 'Shelter & sleep', 'Sleeping bag', 'own', 'sam', '', ts, ts)
  item.run('alexs-book', 'gear', 'Repairs & extras', 'Paperback', 'own', 'alex', '', ts, ts)
  db.prepare(`INSERT INTO claims (item_id, member_id, packed) VALUES ('tent', 'alex', 0)`).run()

  const expense = db.prepare(`INSERT INTO expenses (id, trip_id, description, amount, paid_by, created_at, updated_at)
                              VALUES (?, 'trip', ?, ?, ?, ?, ?)`)
  expense.run('pitch', 'Pitch fee', 6000, 'alex', ts, ts)
  db.prepare(`INSERT INTO expense_participants (expense_id, member_id) VALUES ('pitch', 'sam'), ('pitch', 'alex')`).run()

  const context = () => {
    const { snapshot, refs } = campSnapshot('trip', 'sam')
    return {
      snapshot,
      ctx: campContext({
        tripId: 'trip', memberId: 'sam', memberName: 'Sam', refs, notes: snapshot.trip.notes ?? '',
      }),
    }
  }
  const refFor = (snapshot, title) => snapshot.items.find((i) => i.title === title).ref

  // ---- what Camp sees --------------------------------------------------------

  {
    const { snapshot } = context()
    // The days of the trip, named. Without these a meal plan can only say "Day 1".
    assert.deepEqual(snapshot.trip.days.map((d) => d.date), ['2026-08-14', '2026-08-15', '2026-08-16'])
    assert.equal(snapshot.trip.days[0].weekday, 'Friday')
    assert.equal(snapshot.trip.nights, 2)
    assert.equal(snapshot.trip.notes, 'Gate code 1470.')
    assert.equal(snapshot.trip.locationPinned, true)
    assert.equal(snapshot.trip.phase, 'getting ready')
    assert.equal(snapshot.today.date.length, 10)

    // Dietary needs are shared on purpose: they are for whoever ends up cooking.
    assert.deepEqual(snapshot.members, [{ name: 'Sam', diet: 'no nuts' }, { name: 'Alex' }])

    // Somebody else's personal kit is not on the trip as far as Sam is
    // concerned, and so it is not in the snapshot either.
    const titles = snapshot.items.map((i) => i.title)
    assert.ok(titles.includes('Sleeping bag'))
    assert.ok(!titles.includes('Paperback'))
    assert.deepEqual(snapshot.items.find((i) => i.title === 'Four-person tent').broughtBy, [{ name: 'Alex' }])

    // Nothing has happened to this trip yet, and an empty list is left out
    // rather than sent as a page of nothing.
    assert.equal(snapshot.recentChanges, undefined)

    // The ledger, as the Settle up card would draw it.
    assert.equal(snapshot.money.totalSpent, '60.00')
    assert.equal(snapshot.money.expenses[0].paidBy, 'Alex')
    assert.deepEqual(snapshot.money.settleUp, [{ from: 'Sam', to: 'Alex', amount: '30.00' }])
    assert.deepEqual(snapshot.money.balances, [{ name: 'Sam', net: '-30.00' }, { name: 'Alex', net: '30.00' }])
  }

  // ---- adding, changing, claiming --------------------------------------------

  {
    const { ctx } = context()
    const added = runCampTool('add_items', {
      items: [
        { list: 'food', title: 'Bacon', category: 'Breakfast', qty: '1kg', note: null, kind: 'shared', day: '2026-08-15', time: null, place: null, broughtBy: 'alex' },
        { list: 'food', title: 'Chilli', category: 'Dinner', qty: null, note: null, kind: 'shared', day: '2026-08-14', time: null, place: null, broughtBy: null },
      ],
    }, ctx)
    assert.deepEqual(added.added.map((i) => i.title), ['Bacon'])
    // Something added mid-answer can be referred to for the rest of it.
    const fresh = added.added[0].ref
    assert.equal(runCampTool('update_items', {
      items: [{ ref: fresh, title: null, category: null, qty: '1.5kg', note: null, day: null, time: null, place: null }],
    }, ctx).ok.length, 1)
    assert.equal(db.prepare("SELECT qty FROM items WHERE title = 'Bacon'").get().qty, '1.5kg')
    // The same dinner on the same day is the duplicate this makes easiest.
    assert.deepEqual(added.skippedDuplicates, ['Chilli'])
    assert.deepEqual(added.claimed, [{ title: 'Bacon', member: 'Alex' }])
    const bacon = db.prepare("SELECT id FROM items WHERE title = 'Bacon'").get().id
    assert.ok(db.prepare('SELECT 1 FROM claims WHERE item_id = ? AND member_id = ?').get(bacon, 'alex'))
    // Camp signs its own work in the feed rather than the requester's.
    assert.equal(db.prepare("SELECT actor FROM events WHERE text = 'added Bacon'").get().actor, 'Camp')

    // And reads it back: the change history is the trip's activity feed, newest
    // first — including several written inside the same millisecond, which is
    // what a busy minute of Camp doing as it is told looks like.
    const { snapshot } = context()
    assert.deepEqual(snapshot.recentChanges.map((change) => change.did),
      ['updated Bacon', 'put Alex down for Bacon', 'added Bacon'])
    assert.deepEqual(new Set(snapshot.recentChanges.map((change) => change.who)), new Set(['Camp']))
  }

  {
    const { snapshot, ctx } = context()
    const ref = refFor(snapshot, 'Chilli')
    const done = runCampTool('update_items', {
      items: [{ ref, title: null, category: null, qty: 'for 6', note: 'no nuts — Sam', day: null, time: '18:30', place: null }],
    }, ctx)
    assert.equal(done.ok.length, 1)
    const row = db.prepare("SELECT qty, note, time, day FROM items WHERE id = 'chilli'").get()
    assert.deepEqual({ ...row }, { qty: 'for 6', note: 'no nuts — Sam', time: '18:30', day: '2026-08-14' })

    // A ref the snapshot never issued reaches nothing, which is what stops a
    // guessed id from touching another trip.
    assert.ok(runCampTool('update_items', {
      items: [{ ref: 'i999', title: 'x', category: null, qty: null, note: null, day: null, time: null, place: null }],
    }, ctx).failed[0].reason.includes('no such item'))
  }

  {
    const { snapshot, ctx } = context()
    const ref = refFor(snapshot, 'Four-person tent')
    runCampTool('set_claims', { claims: [{ ref, member: 'me', bringing: true }] }, ctx)
    assert.ok(db.prepare("SELECT 1 FROM claims WHERE item_id = 'tent' AND member_id = 'sam'").get())
    runCampTool('set_claims', { claims: [{ ref, member: 'Alex', bringing: false }] }, ctx)
    assert.ok(!db.prepare("SELECT 1 FROM claims WHERE item_id = 'tent' AND member_id = 'alex'").get())
    // A name nobody on the trip answers to resolves to nobody at all.
    assert.ok(runCampTool('set_claims', {
      claims: [{ ref, member: 'Jordan', bringing: true }],
    }, ctx).failed[0].reason.includes('nobody on this trip'))
  }

  {
    // Ticks are personal. Camp speaks for the requester and for nobody else.
    const { snapshot, ctx } = context()
    runCampTool('set_ticks', {
      state: 'packed',
      items: [
        { ref: refFor(snapshot, 'Four-person tent'), done: true },
        { ref: refFor(snapshot, 'Sleeping bag'), done: true },
      ],
    }, ctx)
    assert.equal(db.prepare("SELECT packed FROM claims WHERE item_id = 'tent' AND member_id = 'sam'").get().packed, 1)
    assert.ok(db.prepare("SELECT 1 FROM own_checks WHERE item_id = 'sams-bag' AND member_id = 'sam'").get())
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM claims WHERE item_id = 'tent' AND member_id = 'alex'").get().n, 0)
  }

  // ---- the trip itself --------------------------------------------------------

  {
    const { ctx } = context()
    const blank = { name: null, start_date: null, end_date: null, notes: null, currency: null, going_home: null }
    assert.ok(runCampTool('update_trip', { ...blank, start_date: 'Friday' }, ctx).error)
    runCampTool('update_trip', { ...blank, notes: 'Gate code 1470. Meet at the Co-op at 9.' }, ctx)
    assert.equal(db.prepare("SELECT notes FROM trips WHERE id = 'trip'").get().notes,
      'Gate code 1470. Meet at the Co-op at 9.')
    assert.equal(db.prepare("SELECT text FROM events ORDER BY rowid DESC LIMIT 1").get().text,
      'wrote down the trip notes')

    runCampTool('set_diet', { member: 'Alex', diet: 'vegetarian' }, ctx)
    assert.equal(db.prepare("SELECT diet FROM members WHERE id = 'alex'").get().diet, 'vegetarian')
  }

  // ---- money -------------------------------------------------------------------

  {
    const { ctx } = context()
    const recorded = runCampTool('record_expense', {
      description: 'Firewood', amount: '12.50', paidBy: 'me', sharedBy: ['Sam', 'Alex'], shares: null,
    }, ctx)
    assert.equal(recorded.amount, '12.50')
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM expense_participants WHERE expense_id = (SELECT id FROM expenses WHERE description = 'Firewood')").get().n, 2)

    // An amount that is a hallucination rather than a pitch fee does not land.
    assert.ok(runCampTool('record_expense', {
      description: 'Firewood', amount: '99999.00', paidBy: 'Sam', sharedBy: ['Sam'], shares: null,
    }, ctx).error.includes('too large'))

    runCampTool('record_payment', { from: 'Sam', to: 'Alex', amount: '20.00', note: null }, ctx)
    assert.equal(db.prepare("SELECT amount FROM payments WHERE from_member = 'sam'").get().amount, 2000)
    assert.ok(runCampTool('record_payment', { from: 'Sam', to: 'Sam', amount: '5.00', note: null }, ctx)
      .error.includes('two different people'))

    // Balances move with it: Sam owed 30, paid 20, and is owed half the firewood.
    const { snapshot } = context()
    assert.deepEqual(snapshot.money.settleUp, [{ from: 'Sam', to: 'Alex', amount: '3.75' }])
  }

  // ---- somebody else's sentence ---------------------------------------------------

  {
    // Whole-field writes land on the text Camp was shown, and not on what
    // somebody typed into the notes while it was answering.
    const { ctx } = context()
    db.prepare("UPDATE trips SET notes = ? WHERE id = 'trip'")
      .run('Gate code 1470. Meet at the Co-op at 9. Jo has the roof box.')
    const stale = runCampTool('update_trip', {
      name: null, start_date: null, end_date: null, currency: null, going_home: null,
      notes: 'Gate code 1470. Meet at the Co-op at 9. And bring the tarp.',
    }, ctx)
    assert.ok(stale.error.includes('somebody else changed the notes'))
    assert.ok(db.prepare("SELECT notes FROM trips WHERE id = 'trip'").get().notes.includes('roof box'))
  }

  // ---- what asks for a change, and what only asks -----------------------------------

  {
    // The gate that decides whether the model is handed tools at all.
    for (const question of [
      '@camp what else do we need?',
      '@camp how cold does it get up there?',
      '@camp who owes what?',
      '@camp is Saturday dinner sorted?',
    ]) assert.equal(campWriteIntent(question), false, question)

    for (const ask of [
      '@camp add a tarp',
      '@camp put Alex down for the bacon',
      '@camp take the paperback off the list',
      '@camp delete the pitch fee',
      '@camp record 12.50 for firewood, I paid',
      '@camp write the gate code into the notes',
    ]) assert.equal(campWriteIntent(ask), true, ask)
  }

  {
    // Whether the room is talking to Camp. The handle says so; so does replying
    // to something Camp said, which is the only way a bare sentence gets in.
    const camp = { id: 1, author: 'Camp', assistant: true, body: 'Saturday looks wet.' }
    const person = { id: 2, author: 'Alex', assistant: false, body: 'Bring the tarp then.' }

    assert.equal(asksCamp('@camp what else do we need?', null), true)
    assert.equal(asksCamp('  @CAMP is Saturday sorted?', null), true)
    assert.equal(asksCamp('are you sure about that?', camp), true)
    assert.equal(asksCamp('yes', camp), true)

    // A reply to a person is a reply to a person, and Camp named in passing is
    // somebody talking about it rather than to it.
    assert.equal(asksCamp('agreed, tarp it is', person), false)
    assert.equal(asksCamp('agreed, tarp it is', null), false)
    assert.equal(asksCamp('I asked @camp about this yesterday', person), false)
    assert.equal(asksCamp('@campfire is a better name', null), false)
    assert.equal(asksCamp('', null), false)
  }

  {
    // The yes that answers a proposal, and the many things that are not one.
    for (const yes of [
      'yes', 'Yes please', '@camp yes', 'go ahead', 'do it', 'yep, confirm',
      '@camp how many confirmation do you need yes do it',
    ]) {
      assert.equal(campConfirmIntent(yes), true, yes)
    }
    for (const no of [
      'no', "don't", 'not the pitch fee', 'yes to the tarp but not the chilli',
      'yes, and also delete the bacon', 'did Josh say yes?', 'if Josh says yes, do it',
      'yes, do not do it', '', '@camp',
    ]) assert.equal(campConfirmIntent(no), false, no)
  }

  // ---- deleting, which is proposed and then confirmed ---------------------------------

  {
    // A removal tool writes nothing. It comes back with what would go.
    const { snapshot, ctx } = context()
    const proposed = runCampTool('remove_items', { refs: [refFor(snapshot, 'Bacon')] }, ctx)
    assert.equal(proposed.nothingDeletedYet, true)
    assert.deepEqual(proposed.wouldRemove, ['Bacon'])
    assert.ok(db.prepare("SELECT 1 FROM items WHERE title = 'Bacon'").get(), 'the tool deleted something')

    // A second call in the same answer adds to the same proposal rather than
    // replacing it, and money and things can be in one list.
    const pitch = snapshot.money.expenses.find((e) => e.description === 'Pitch fee').ref
    const both = runCampTool('remove_money', { refs: [pitch] }, ctx)
    assert.equal(both.wouldRemove.length, 2)
    assert.ok(db.prepare("SELECT 1 FROM expenses WHERE id = 'pitch'").get())

    // Anything that is not a yes throws the whole proposal away — which is
    // what stops "drop Alex from the tent" from ever authorising money.
    assert.ok(campStagedRemoval('trip', 'sam'))
    clearCampStagedRemoval('trip', 'sam')
    assert.equal(campStagedRemoval('trip', 'sam'), null)
    assert.equal(applyCampStagedRemoval('trip', 'sam'), null)
    assert.ok(db.prepare("SELECT 1 FROM items WHERE title = 'Bacon'").get())
    assert.ok(db.prepare("SELECT 1 FROM expenses WHERE id = 'pitch'").get())
  }

  {
    // And the yes, which deletes exactly what was named and nothing else.
    const { snapshot, ctx } = context()
    runCampTool('remove_items', { refs: [refFor(snapshot, 'Bacon')] }, ctx)
    const done = applyCampStagedRemoval('trip', 'sam')
    assert.deepEqual(done.removed, ['Bacon'])
    assert.ok(!db.prepare("SELECT 1 FROM items WHERE title = 'Bacon'").get())
    // The pitch fee was in the proposal that was thrown away, and stays put.
    assert.ok(db.prepare("SELECT 1 FROM expenses WHERE id = 'pitch'").get())
    // The yes is spent: saying it twice does not delete anything twice.
    assert.equal(applyCampStagedRemoval('trip', 'sam'), null)
  }

  {
    // A row that goes away between the proposal and the yes is not an error.
    const { snapshot, ctx } = context()
    const pitch = snapshot.money.expenses.find((e) => e.description === 'Pitch fee').ref
    runCampTool('remove_money', { refs: [pitch] }, ctx)
    db.prepare("DELETE FROM expenses WHERE id = 'pitch'").run()
    const done = applyCampStagedRemoval('trip', 'sam')
    assert.equal(done.removed, undefined)
    assert.equal(done.missed[0].reason, 'already gone')
  }

  // ---- the ceilings ---------------------------------------------------------------

  {
    const { ctx } = context()
    const many = Array.from({ length: CAMP_LIMITS.add + 5 }, (_, i) => ({
      list: 'gear', title: `Thing ${i}`, category: null, qty: null, note: null,
      kind: 'shared', day: null, time: null, place: null, broughtBy: null,
    }))
    const first = runCampTool('add_items', { items: many }, ctx)
    assert.equal(first.added.length, CAMP_LIMITS.add)
    assert.equal(first.notAdded, 5)
    // Spent is spent: a second call in the same answer has nothing left.
    assert.ok(runCampTool('add_items', { items: many }, ctx).error.includes('no room left'))
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM items WHERE title LIKE 'Thing %'").get().n, CAMP_LIMITS.add)
  }

  // A membership that goes away while the model is thinking takes its authority
  // with it, whatever the model has already decided to do.
  {
    const { ctx } = context(true)
    // The ledger holds people on the trip, so it goes first — as it does when
    // somebody is removed through the app.
    db.prepare('DELETE FROM payments').run()
    db.prepare('DELETE FROM expenses').run()
    db.prepare("DELETE FROM members WHERE id = 'sam'").run()
    assert.ok(runCampTool('remove_items', { refs: ['i1'] }, ctx).error.includes('no longer on this trip'))
  }

  db.close()
  console.log('camp assistant smoke passed')
} finally {
  for (const suffix of ['', '-shm', '-wal']) rmSync(`${path}${suffix}`, { force: true })
}
