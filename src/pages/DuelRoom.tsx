import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ReactionGame } from '../components/ReactionGame'
import { connectWallet, payNim } from '../lib/nimiq'
import { Duel, supabase } from '../lib/supabase'

type Role = 'creator' | 'opponent' | 'spectator'

export function DuelRoom() {
  const { id } = useParams<{ id: string }>()
  const [duel, setDuel] = useState<Duel | null>(null)
  const [myWallet, setMyWallet] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDuel = useCallback(async () => {
    if (!id)
      return
    const { data, error: dbError } = await supabase.from('duels').select('*').eq('id', id).single()
    if (dbError)
      setError('Could not load this duel. Check your connection and try refreshing.')
    else if (data)
      setDuel(data as Duel)
  }, [id])

  useEffect(() => {
    fetchDuel()
  }, [fetchDuel])

  // Async duel: poll instead of holding a live socket open, since players
  // aren't necessarily online at the same time.
  useEffect(() => {
    if (!duel || duel.status === 'resolved' || duel.status === 'expired')
      return
    const interval = setInterval(fetchDuel, 2500)
    return () => clearInterval(interval)
  }, [duel, fetchDuel])

  async function handleConnect() {
    setConnecting(true)
    setError(null)
    try {
      const wallet = await connectWallet()
      setMyWallet(wallet)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    finally {
      setConnecting(false)
    }
  }

  async function acceptDuel() {
    if (!duel || !myWallet)
      return
    setError(null)
    const { data, error: dbError } = await supabase
      .from('duels')
      .update({ opponent_wallet: myWallet })
      .eq('id', duel.id)
      .is('opponent_wallet', null)
      .select()
      .single()
    if (dbError)
      setError('Could not accept the duel. Someone may have already taken it — try refreshing.')
    else if (data)
      setDuel(data as Duel)
  }

  async function submitReaction(reactionMs: number, role: 'creator' | 'opponent') {
    if (!duel)
      return
    setError(null)
    const field = role === 'creator' ? 'creator_reaction_ms' : 'opponent_reaction_ms'
    const { data, error: dbError } = await supabase
      .from('duels')
      .update({ [field]: reactionMs })
      .eq('id', duel.id)
      .select()
      .single()
    if (dbError || !data) {
      setError('Could not save your result. Check your connection and try again.')
      return
    }
    const updated = data as Duel
    setDuel(updated)

    if (updated.creator_reaction_ms != null && updated.opponent_reaction_ms != null && updated.status === 'waiting') {
      const winner = updated.creator_reaction_ms <= updated.opponent_reaction_ms
        ? updated.creator_wallet
        : updated.opponent_wallet!
      const { data: resolved } = await supabase
        .from('duels')
        .update({ status: 'resolved', winner_wallet: winner })
        .eq('id', duel.id)
        .eq('status', 'waiting')
        .select()
        .single()
      if (resolved)
        setDuel(resolved as Duel)
    }
  }

  async function payLoser() {
    if (!duel || !duel.winner_wallet)
      return
    setPaying(true)
    setError(null)
    try {
      const txHash = await payNim(duel.winner_wallet, duel.stake_amount, `NIM Duel ${duel.id}`)
      const { data } = await supabase
        .from('duels')
        .update({ payout_tx_hash: txHash })
        .eq('id', duel.id)
        .select()
        .single()
      if (data)
        setDuel(data as Duel)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    finally {
      setPaying(false)
    }
  }

  if (!duel) {
    return (
      <div className="screen">
        <p>Loading duel…</p>
      </div>
    )
  }

  if (!myWallet) {
    return (
      <div className="screen">
        <h1 className="title">NIM Duel</h1>
        <p className="tagline">
          {duel.creator_name || 'A challenger'}
          {' '}
          staked
          {' '}
          {duel.stake_amount}
          {' '}
          NIM. Connect your wallet to view or accept.
        </p>
        {error && <p className="error">{error}</p>}
        <button type="button" className="primary-btn" onClick={handleConnect} disabled={connecting}>
          {connecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
      </div>
    )
  }

  const role: Role = myWallet === duel.creator_wallet
    ? 'creator'
    : myWallet === duel.opponent_wallet
      ? 'opponent'
      : 'spectator'

  if (duel.status === 'resolved') {
    const iWon = duel.winner_wallet === myWallet
    const iLost = (role === 'creator' || role === 'opponent') && !iWon
    return (
      <div className="screen">
        <h1 className="title">{iWon ? 'You won! 🎉' : iLost ? 'You lost' : 'Duel over'}</h1>
        <p className="tagline">
          Creator:
          {' '}
          {duel.creator_reaction_ms}
          ms · Opponent:
          {' '}
          {duel.opponent_reaction_ms}
          ms
        </p>
        {iLost && !duel.payout_tx_hash && (
          <>
            {error && <p className="error">{error}</p>}
            <button type="button" className="primary-btn" onClick={payLoser} disabled={paying}>
              {paying ? 'Confirm in wallet…' : `Pay ${duel.stake_amount} NIM to winner`}
            </button>
          </>
        )}
        {iWon && !duel.payout_tx_hash && <p className="footnote">Waiting for the loser to settle up…</p>}
        {duel.payout_tx_hash && <p className="footnote">Settled. Tx: {duel.payout_tx_hash.slice(0, 16)}…</p>}
      </div>
    )
  }

  if (role === 'creator') {
    if (duel.creator_reaction_ms == null) {
      return (
        <div className="screen">
          <h1 className="title">Play your shot</h1>
          <p className="tagline">Wait for GO, then tap as fast as you can.</p>
          {error && <p className="error">{error}</p>}
          <ReactionGame onComplete={ms => submitReaction(ms, 'creator')} />
        </div>
      )
    }
    return (
      <div className="screen">
        <h1 className="title">Waiting for a challenger</h1>
        <p className="tagline">
          Your reaction:
          {' '}
          {duel.creator_reaction_ms}
          ms. Share this link:
        </p>
        <input className="share-link" readOnly value={window.location.href} onFocus={e => e.currentTarget.select()} />
      </div>
    )
  }

  if (role === 'opponent') {
    if (duel.opponent_reaction_ms == null) {
      return (
        <div className="screen">
          <h1 className="title">Your turn</h1>
          <p className="tagline">Wait for GO, then tap as fast as you can.</p>
          {error && <p className="error">{error}</p>}
          <ReactionGame onComplete={ms => submitReaction(ms, 'opponent')} />
        </div>
      )
    }
    return (
      <div className="screen">
        <p>Reaction recorded. Waiting for the match to resolve…</p>
      </div>
    )
  }

  // spectator: either unclaimed (can accept) or already taken by someone else
  if (!duel.opponent_wallet) {
    return (
      <div className="screen">
        <h1 className="title">Accept the duel</h1>
        <p className="tagline">
          Stake
          {' '}
          {duel.stake_amount}
          {' '}
          NIM against
          {' '}
          {duel.creator_name || 'the challenger'}
          . Fastest reaction wins both stakes.
        </p>
        {error && <p className="error">{error}</p>}
        <button type="button" className="primary-btn" onClick={acceptDuel}>Accept & Play</button>
      </div>
    )
  }

  return (
    <div className="screen">
      <p>This duel already has a challenger.</p>
    </div>
  )
}
