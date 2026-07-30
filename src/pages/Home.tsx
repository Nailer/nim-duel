import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectWallet } from '../lib/nimiq'
import { supabase } from '../lib/supabase'

export function Home() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [stake, setStake] = useState('1')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createDuel() {
    setError(null)
    const stakeAmount = Number(stake)
    if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) {
      setError('Enter a valid stake amount.')
      return
    }

    setConnecting(true)
    try {
      const wallet = await connectWallet()
      const { data, error: dbError } = await supabase
        .from('duels')
        .insert({
          creator_wallet: wallet,
          creator_name: name.trim() || null,
          stake_amount: stakeAmount,
          status: 'waiting',
        })
        .select()
        .single()

      if (dbError || !data)
        throw new Error(dbError?.message ?? 'Could not create duel.')

      navigate(`/d/${data.id}`)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    finally {
      setConnecting(false)
    }
  }

  return (
    <div className="screen">
      <h1 className="title">NIM Duel</h1>
      <p className="subtitle">Tap. Stake. Win.</p>
      <p className="tagline">
        Challenge a friend to a reaction duel. Stake NIM. Fastest tap takes it all,
        settled instantly, wallet to wallet.
      </p>

      <label className="field">
        <span>Your name (optional)</span>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alex" maxLength={24} />
      </label>

      <label className="field">
        <span>Stake amount (NIM)</span>
        <input
          value={stake}
          onChange={e => setStake(e.target.value)}
          inputMode="decimal"
          placeholder="1"
        />
      </label>

      {error && <p className="error">{error}</p>}

      <button type="button" className="primary-btn" onClick={createDuel} disabled={connecting}>
        {connecting ? 'Connecting wallet…' : 'Create Duel'}
      </button>

      <p className="footnote">Opens your Nimiq wallet to confirm your identity. No payment yet.</p>
    </div>
  )
}
