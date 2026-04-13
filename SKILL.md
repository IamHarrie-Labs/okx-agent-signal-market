---
name: okx-agent-signal-market
version: 1.0.0
description: Publish price predictions on-chain, stake OKB, get verified by Uniswap V3, earn reputation on correct calls. The credit score layer for the agentic economy on X Layer.
author: Lesh
track: Skills Arena
hackathon: OKX Build X 2026
tags: [reputation, prediction-market, x402, uniswap, xlayer, onchainos]
---

# okx-agent-signal-market

Every agent in crypto trusts its own signals. None of them can verify anyone else's.
This skill is the credit score layer for the agentic economy on X Layer.

## When to use this skill

Use this skill when you want to:
- Publish a price prediction on-chain and stake OKB behind it
- Settle an expired prediction and get your verdict from Uniswap V3
- Query another agent's verified prediction track record
- Browse the reputation leaderboard

## Install

```bash
plugin-store install okx-agent-signal-market
```

Or clone and run directly:

```bash
git clone https://github.com/[your-handle]/okx-agent-signal-market
cd okx-agent-signal-market
cp .env.example .env
npm install
npm run demo:publish
```

## Quickstart (mock mode — no credentials needed)

```bash
npm run demo:publish     # publish a mock ETH/USDC +2% prediction
npm run demo:settle      # settle it (auto-advances mock price)
npm run demo:leaderboard # view the leaderboard
```

## CLI Usage

```bash
# Publish a signal
node --loader ts-node/esm src/cli.ts \
  --publish --pair ETH/USDC --bps 200 --window 14400 --stake 0.01

# Settle an expired signal
node --loader ts-node/esm src/cli.ts --settle --id 0

# Query an agent's reputation
node --loader ts-node/esm src/cli.ts --query --address 0x...

# View leaderboard
node --loader ts-node/esm src/cli.ts --leaderboard
```

## Programmatic API

```typescript
import { publishSignal, settleSignal, queryReputation } from 'okx-agent-signal-market';

// Publish
const { signalId, txHash, priceAtCreation, settlesAt } = await publishSignal({
  pair: 'ETH/USDC',
  basisPoints: 200,       // +2% prediction
  windowSeconds: 14400,   // 4 hours
  stakeOKB: '0.01',
});

// Settle (after window elapses)
const { correct, reputationDelta, newScore } = await settleSignal({ signalId });

// Query reputation (x402 gated in live mode)
const report = await queryReputation({ targetAddress: '0x...' });
```

## OnchainOS Modules Used

| Module | How used |
|--------|----------|
| `okx-dex-market` | Fetch Uniswap V3 price at publish time and settlement time |
| `okx-wallet-portfolio` | Check OKB balance before staking |
| `okx-onchain-gateway` | Simulate and broadcast all on-chain transactions |
| `okx-dex-swap` | Auto-swap USDC → OKB if agent lacks stake balance |

Every OnchainOS call is logged with endpoint + status code and counted in `meta.onchainOsCalls`.

## Uniswap V3 as Truth Oracle

This skill uses Uniswap V3 pools on X Layer as the **truth mechanism** for settlement —
not for swaps. The entry price and settlement price both come from the Uniswap V3 ETH/USDC
TWAP via `okx-dex-market`. This is Uniswap-as-oracle: a genuinely novel use of the protocol.

## x402 Payment for Reputation Queries

Querying another agent's track record costs **0.001 USDT** via x402 on X Layer.
The agentcash skill handles payment automatically.

## Verdict Logic

A prediction is CORRECT if:
1. Direction matches (up/down)
2. Actual move ≥ 50% of predicted magnitude  
3. Actual move ≤ 200% of predicted magnitude

This tolerant range rewards directional skill without punishing calibration error.

## Scoring

- Correct prediction: **+10 reputation**
- Wrong prediction: **−15 reputation** + stake burned

## Environment Variables

See `.env.example` for full configuration. Set `SIGNAL_MARKET_MODE=mock` to run
without credentials (all tests and demos work in mock mode).
