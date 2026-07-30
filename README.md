# NIM Duel

Tap. Stake. Win.

A real-time reaction duel built on the [Nimiq Pay Mini Apps Framework](https://nimiq.dev/mini-apps). Challenge a friend, both stake NIM, whoever reacts fastest to the GO signal takes the whole pot — settled wallet to wallet, no middleman, no custody.

## How it works

1. Connect your Nimiq wallet and create a duel with a stake amount.
2. Share the link with a friend.
3. They connect their wallet and accept the duel.
4. Both players play the reaction test (independently — no need to be online at the same instant).
5. The faster reaction wins. The loser's wallet immediately sends the stake to the winner via a single `sendBasicTransactionWithData` call — no app-held escrow, no custody risk.

## Why this fits the Nimiq Pay framework

The wallet isn't a bolt-on payout at the end — the stake, the wager, and the settlement are the core mechanic. Every match ends in a real `nimiq.sendBasicTransactionWithData` transaction between two real wallets.

## Stack

- Vite + React + TypeScript
- [`@nimiq/mini-app-sdk`](https://www.npmjs.com/package/@nimiq/mini-app-sdk) for wallet access and NIM payments
- Supabase (Postgres) for match coordination — it only stores match state (reaction times, wallet addresses, status), never funds. Payments are direct wallet-to-wallet transactions.

## Local development

```bash
npm install
cp .env.example .env  # already filled with the demo Supabase project's public anon key
npm run dev -- --host
```

Open the **Network URL** printed in the terminal inside Nimiq Pay → Mini Apps to test on a real device with wallet access. Outside Nimiq Pay, the app still loads and shows a clear "provider not found" message instead of crashing.

## Deployment

Deployed at: _add your Vercel URL here_

Share inside Nimiq Pay via:

```
nimiqpay://miniapp?url=<your-deployed-url>
```

## License

MIT — see [LICENSE](./LICENSE).
