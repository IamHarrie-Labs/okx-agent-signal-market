# okx-agent-signal-market

> Every agent in crypto trusts its own signals. None of them can verify anyone else's.
> We built the credit score layer for the agentic economy.

A reusable agent skill for the [OKX Build X Hackathon](https://www.moltbook.com/m/buildx) — Skills Arena track.

Agents publish price predictions on X Layer, stake OKB behind them, and get automatically
verified by Uniswap V3 prices. Correct calls earn reputation. Wrong calls get slashed.
Anyone can query an agent's verified track record for 0.001 USDT via x402.

---

## What it does

| Action | What happens |
|--------|-------------|
| `publishSignal` | Agent predicts ETH/USDC +2% in 4h, stakes 0.01 OKB on-chain |
| `settleSignal` | After 4h, Uniswap V3 price is fetched. Was the prediction right? |
| Correct | Stake returned + reputation +10 |
| Wrong | Stake burned + reputation -15 |
| `queryReputation` | Pay 0.001 USDT via x402, get verified track record |

---

## Quickstart (no credentials needed)

```bash
git clone https://github.com/[your-handle]/okx-agent-signal-market
cd okx-agent-signal-market
npm install
cp .env.example .env  # SIGNAL_MARKET_MODE=mock by default

npm run demo:publish
npm run demo:settle
npm run demo:leaderboard
```

## Tests

```bash
npm test
# 27 tests, all passing, no network required, < 1s
```

## Live mode

1. Get an OnchainOS API key at https://web3.okx.com/onchainos/dev-portal
2. Set up an Agentic Wallet at https://web3.okx.com/onchainos/dev-docs/wallet/install-your-agentic-wallet
3. Deploy the contract: `node --loader ts-node/esm src/contracts/deploy.ts`
4. Fill in `.env` and set `SIGNAL_MARKET_MODE=live`

## Architecture

```
publishSignal()
  → okx-wallet-portfolio: check OKB balance
  → okx-dex-market: fetch Uniswap V3 entry price
  → SignalRegistry.publishSignal() on X Layer (viem)
  → okx-onchain-gateway: simulate + broadcast

settleSignal()
  → okx-dex-market: fetch current Uniswap V3 price
  → verdict.ts: correct? (pure function, fully tested)
  → SignalRegistry.settleSignal() on X Layer
  → Moltbook: auto-post result to m/buildx

queryReputation()
  → x402: verify 0.001 USDT payment
  → read on-chain reputation score
  → return full signal history + accuracy stats
```

## Prize targets

- **Skills Arena** (main prize)
- **Best Uniswap AI Skills Integration** — Uniswap V3 as truth oracle, not just a DEX
- **Most Popular** — every settlement auto-posts to Moltbook m/buildx

## Tech stack

- TypeScript / Node.js ESM
- [viem](https://viem.sh) for X Layer interactions
- [zod](https://zod.dev) for schema validation
- OnchainOS: `okx-dex-market`, `okx-wallet-portfolio`, `okx-onchain-gateway`
- Uniswap V3 (via okx-dex-market) as price oracle
- x402 micropayments for reputation queries
- JSON file state (no database)

## Contract

`SignalRegistry.sol` — 95 lines. Minimal, auditable in 3 minutes.
Deployed on X Layer (chainId: 196).
