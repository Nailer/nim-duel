import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(url, anonKey)

export type DuelStatus = 'waiting' | 'ready' | 'resolved' | 'expired'

export interface Duel {
  id: string
  creator_wallet: string
  creator_name: string | null
  opponent_wallet: string | null
  opponent_name: string | null
  stake_amount: number
  status: DuelStatus
  creator_reaction_ms: number | null
  opponent_reaction_ms: number | null
  winner_wallet: string | null
  payout_tx_hash: string | null
  created_at: string
  expires_at: string
}
