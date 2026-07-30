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

function unwrap<T>(result: T | { error: { type: string, message: string } }): T {
  if (result && typeof result === 'object' && 'error' in result) {
    throw new Error(result.error.message || result.error.type)
  }
  return result
}

export async function connectWallet(): Promise<string> {
  const nimiq = await getNimiq()
  const accounts = unwrap(await nimiq.listAccounts())
  if (!accounts.length) {
    throw new Error('No Nimiq account found in this wallet.')
  }
  return accounts[0]
}

export async function payNim(recipient: string, amountNim: number, memo: string): Promise<string> {
  const nimiq = await getNimiq()
  return unwrap(await nimiq.sendBasicTransactionWithData({
    recipient,
    value: nimToLuna(amountNim),
    data: memo,
  }))
}
