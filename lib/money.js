// The ledger's own rules, kept away from the routes so the assistant can be
// held to them too. An expense recorded by asking Camp for it has to be the
// same row, with the same participants and the same refusals, as one typed into
// Settle up — anything else is a second ledger with the same name.
import { db } from './db.js'
import { clean, money } from './fields.js'

// Fields for a new or edited expense, or `{ error }` saying what is wrong with
// them in the words the person will read. The caller decides how to deliver it:
// a status code to a browser, a tool result to the model.
export function expenseFields(body, tripId) {
  const description = clean(body?.description, 120)
  if (!description) return { error: 'Say what this expense was for.' }

  const amount = money(body?.amount)
  if (!amount) {
    return { error: amount === null
      ? 'Enter a cost with no more than two decimal places.'
      : 'Enter a cost greater than zero.' }
  }

  const paidBy = clean(body?.paidBy, 64)
  const participantIds = [...new Set(Array.isArray(body?.participants)
    ? body.participants.map((id) => clean(id, 64)).filter(Boolean)
    : [])]
  if (!participantIds.length) return { error: 'Choose at least one person to share this expense.' }

  const members = db.prepare('SELECT id FROM members WHERE trip_id = ?').all(tripId)
  const known = new Set(members.map((member) => member.id))
  if (!known.has(paidBy)) return { error: 'Choose somebody on this trip as the payer.' }
  if (participantIds.some((id) => !known.has(id))) {
    return { error: 'Every person sharing this expense must be on the trip.' }
  }

  const split = body?.split === undefined || body.split === 'equal' ? 'equal' : body.split
  if (split !== 'custom') {
    if (split !== 'equal') return { error: 'Choose an equal or custom split.' }
    return {
      description, amount, paidBy,
      participants: participantIds.map((memberId) => ({ memberId, shareAmount: null })),
    }
  }

  const rawShares = body?.shares
  if (!rawShares || typeof rawShares !== 'object' || Array.isArray(rawShares)) {
    return { error: 'Enter a share for everyone in the custom split.' }
  }
  const participants = participantIds.map((memberId) => ({
    memberId,
    shareAmount: money(rawShares[memberId]),
  }))
  if (participants.some(({ shareAmount }) => !shareAmount)) {
    return { error: 'Every custom share must be greater than zero and use no more than two decimal places.' }
  }
  if (participants.reduce((sum, row) => sum + row.shareAmount, 0) !== amount) {
    return { error: `Custom shares must add up to ${(amount / 100).toFixed(2)}.` }
  }
  return { description, amount, paidBy, participants }
}

export function writeExpense(expenseId, participants, write) {
  const remove = db.prepare('DELETE FROM expense_participants WHERE expense_id = ?')
  const add = db.prepare(`INSERT INTO expense_participants (expense_id, member_id, share_amount)
                          VALUES (?, ?, ?)`)
  db.exec('BEGIN')
  try {
    write()
    remove.run(expenseId)
    for (const { memberId, shareAmount } of participants) add.run(expenseId, memberId, shareAmount)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

// A change to the ledger, the note about it and the revision every other phone
// is watching are one fact, so they are one commit. Half of them landing leaves
// money recorded that nobody else is told to come and look at.
export function ledgerWrite(run) {
  db.exec('BEGIN')
  try {
    const result = run()
    db.exec('COMMIT')
    return result
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

// Who is up and who is down, and the fewest handovers that would square it.
// This is the same arithmetic the Settle up card draws, written once more on
// the server so that asking Camp "what do I owe?" cannot answer with a
// different number from the one on the screen next to it. If either changes,
// both change: an equal split gives leftover pennies to the first names in the
// trip's stable order, and a payment nets in rather than crossing a suggested
// transfer off.
export function settlement(members = [], expenses = [], payments = []) {
  if (!members.length) return { count: 0, total: 0, settled: 0, rounded: false, balances: [], transfers: [] }
  const known = new Map(members.map((m) => [m.id, m]))
  const balances = new Map(members.map((m) => [m.id, 0]))
  let count = 0, total = 0, rounded = false

  for (const expense of expenses) {
    const amount = Number(expense.amount)
    const payerId = expense.paid_by
    const sharing = new Set(expense.participants ?? [])
    const participants = members.filter((member) => sharing.has(member.id))
    if (!Number.isSafeInteger(amount) || amount <= 0 || !known.has(payerId) || !participants.length) continue

    const custom = expense.shares !== null && expense.shares !== undefined
    let portions
    if (custom) {
      portions = participants.map((member) => Number(expense.shares?.[member.id]))
      if (portions.some((share) => !Number.isSafeInteger(share) || share <= 0)
          || portions.reduce((sum, share) => sum + share, 0) !== amount) continue
    } else {
      const share = Math.floor(amount / participants.length)
      const remainder = amount % participants.length
      if (remainder) rounded = true
      portions = participants.map((_, i) => share + (i < remainder ? 1 : 0))
    }

    count++
    total += amount
    balances.set(payerId, balances.get(payerId) + amount)
    participants.forEach((member, i) => {
      balances.set(member.id, balances.get(member.id) - portions[i])
    })
  }

  let settled = 0
  for (const payment of payments) {
    const amount = Number(payment.amount)
    if (!Number.isSafeInteger(amount) || amount <= 0) continue
    if (!known.has(payment.from_member) || !known.has(payment.to_member)) continue
    if (payment.from_member === payment.to_member) continue
    settled += amount
    balances.set(payment.from_member, balances.get(payment.from_member) + amount)
    balances.set(payment.to_member, balances.get(payment.to_member) - amount)
  }

  const debtors = members.map((member) => ({ member, amount: -(balances.get(member.id) ?? 0) }))
    .filter((x) => x.amount > 0)
  const creditors = members.map((member) => ({ member, amount: balances.get(member.id) ?? 0 }))
    .filter((x) => x.amount > 0)
  const transfers = []
  let owing = 0, owed = 0
  while (owing < debtors.length && owed < creditors.length) {
    const amount = Math.min(debtors[owing].amount, creditors[owed].amount)
    transfers.push({ from: debtors[owing].member, to: creditors[owed].member, amount })
    debtors[owing].amount -= amount
    creditors[owed].amount -= amount
    if (!debtors[owing].amount) owing++
    if (!creditors[owed].amount) owed++
  }

  return {
    count,
    total,
    settled,
    rounded,
    balances: members.map((member) => ({ member, net: balances.get(member.id) ?? 0 })),
    transfers,
  }
}
