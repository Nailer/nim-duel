import { init } from '@nimiq/mini-app-sdk'

const LUNA_PER_NIM = 100_000

export function nimToLuna(nim: number): number {
  return Math.round(nim * LUNA_PER_NIM)
}

let nimiqPromise: ReturnType<typeof init> | null = null

export function getNimiq() {
  if (!nimiqPromise) {
    nimiqPromise = init({ timeout: 10_000 })
  }
  return nimiqPromise
}

// Native/provider errors don't reliably arrive as plain strings -- pull the
// first readable string out of whatever shape we're handed instead of
// letting `String(obj)` collapse it to "[object Object]".
function extractMessage(value: unknown, depth = 0): string | null {
  if (depth > 4 || value == null)
    return null
  if (typeof value === 'string')
    return value
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of ['message', 'description', 'reason', 'error', 'type']) {
      const found = extractMessage(obj[key], depth + 1)
      if (found)
        return found
    }
  }
  return null
}

function isErrorResponse(result: unknown): result is { error: unknown } {
  return !!result && typeof result === 'object' && 'error' in result
}

function unwrap<T>(result: T): Exclude<T, { error: unknown }> {
  if (isErrorResponse(result)) {
    const message = extractMessage(result.error)
    throw new Error(message ?? 'The wallet rejected this request. Please try again.')
  }
  return result as Exclude<T, { error: unknown }>
}

export function toErrorMessage(err: unknown): string {
  if (err instanceof Error)
    return extractMessage(err.message) ?? err.message
  return extractMessage(err) ?? 'Something went wrong. Please try again.'
}

export async function connectWallet(): Promise<string> {
  const nimiq = await getNimiq()
  const accounts = unwrap(await nimiq.listAccounts())
  if (!accounts.length) {
    throw new Error('No Nimiq account found in this wallet.')
  }
  return accounts[0]
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Sending a transaction while the wallet hasn't reached network consensus
// yet fails with an opaque "syncing your account" error. Wait for
// consensus first so the payment has a real chance of succeeding.
//
// This can take a while, especially on Testnet where peer availability
// is much sparser than Mainnet -- the timeout is generous on purpose.
async function waitForConsensus(nimiq: Awaited<ReturnType<typeof init>>, timeoutMs = 45_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await nimiq.isConsensusEstablished())
      return
    await sleep(1000)
  }
  throw new Error('Your Nimiq wallet is still reconnecting to the network. Wait a moment and try again -- this is more common on Testnet, which has fewer peers than Mainnet.')
}

function isSyncRelated(message: string): boolean {
  return /sync/i.test(message)
}

function isUserRejection(message: string): boolean {
  return /reject|denied|cancel/i.test(message)
}

export async function payNim(recipient: string, amountNim: number, memo: string): Promise<string> {
  const nimiq = await getNimiq()
  await waitForConsensus(nimiq)
  // `isConsensusEstablished()` flips true for network consensus slightly
  // before the wallet's own account balance/UTXO state has finished
  // settling. Sending immediately on that edge is what produces the
  // "syncing your account" failure. A short grace period avoids it.
  await sleep(1500)

  const maxAttempts = 4
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return unwrap(await nimiq.sendBasicTransactionWithData({
        recipient,
        value: nimToLuna(amountNim),
        data: memo,
      }))
    }
    catch (err) {
      const message = toErrorMessage(err)
      lastError = err instanceof Error ? err : new Error(message)

      // Don't retry a deliberate user cancellation -- only retry
      // transient account-sync failures.
      if (isUserRejection(message) || !isSyncRelated(message) || attempt === maxAttempts) {
        throw lastError
      }
      await sleep(2000 * attempt)
    }
  }

  throw lastError ?? new Error('Payment failed. Please try again.')
}
