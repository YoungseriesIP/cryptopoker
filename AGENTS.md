# Arc Poker

> Built with Arc Studio — money-powered apps in minutes

Real-money Texas Hold'em poker tournaments on Arc Testnet, with USDC entry fees and on-chain settlement.

---

## What This App Does

- Players connect a wallet, join or create a poker tournament with a USDC buy-in
- Real-time multiplayer via WebSockets (Bun server)
- On-chain settlement: entry fees go into a smart contract escrow, winner receives the prize pool
- Supports Arc Testnet (Chain ID: 5042002); native gas IS USDC on Arc

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Web3**: wagmi v2, viem v2, ConnectKit
- **Backend**: Bun WebSocket server (`server/game-server.ts`) on port 3001
- **Contracts**: Solidity 0.8.28 + Foundry (`contracts/`)
- **Chain**: Arc Testnet (Chain ID: 5042002)
- **Token**: USDC — address `0x3600000000000000000000000000000000000000`, 6 decimals

## Key Files

| Path | Purpose |
|------|---------|
| `src/App.tsx` | Root: screen router, join/create flow, chain guard |
| `src/components/HomeScreen.tsx` | Landing + wallet connect |
| `src/components/LobbyScreen.tsx` | Tournament list + create sheet |
| `src/components/PokerTable.tsx` | Game table (responsive: oval desktop / list mobile) |
| `src/components/WinnerScreen.tsx` | End-of-tournament payout screen |
| `src/components/ChainGuard.tsx` | Banner that prompts wallet to switch to Arc Testnet |
| `src/hooks/usePokerGame.ts` | WebSocket client hook — all game state |
| `src/lib/poker-engine.ts` | Pure hand evaluator, deck, blind schedule |
| `src/types/poker.ts` | Shared TypeScript types |
| `server/game-server.ts` | Bun WebSocket server — game logic, state, broadcasting |
| `src/config.ts` | wagmi config (Arc Testnet RPC wired explicitly) |
| `src/onchain-facts.ts` | Chain IDs, RPC URLs, USDC addresses (generated — do not edit) |

## Deployed Contracts

_(none yet — ArcPokerTournament.sol ready to deploy)_

## Running Locally

```bash
bun install

# Terminal 1 — game server
bun run server

# Terminal 2 — frontend
bun run dev
```

Open http://localhost:5173. The Vite proxy forwards `/api/ws` → `ws://localhost:3001/ws`.

---

## Production Deployment

The frontend is a static Vite build. The backend is a standalone Bun WebSocket server.
They must be deployed separately.

### Step 1 — Deploy the game server (Railway — easiest)

1. Push this repo to GitHub.
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
3. Railway auto-detects `railway.json` + `Dockerfile` and builds the image.
4. In Railway → Settings → Networking: enable a public domain (e.g. `arc-poker-server.up.railway.app`).
5. Note the public URL: `https://arc-poker-server.up.railway.app`
6. The WebSocket endpoint will be: `wss://arc-poker-server.up.railway.app/ws`

**Or deploy to Fly.io:**
```bash
fly launch --no-deploy --name arc-poker-server
fly deploy
```
The endpoint will be `wss://arc-poker-server.fly.dev/ws`.

---

### Step 2 — Set VITE_WS_URL and rebuild the frontend

Once you have the server URL, set the env var and redeploy to Netlify:

```bash
# In Netlify UI → Site settings → Environment variables:
VITE_WS_URL = wss://arc-poker-server.up.railway.app/ws

# Or locally:
echo 'VITE_WS_URL=wss://arc-poker-server.up.railway.app/ws' >> .env.local
bun run build
```

Then redeploy the `dist/` folder to Netlify (or trigger an automatic redeploy if CI is wired).

If `VITE_WS_URL` is **not set**, the frontend falls back to same-host `/api/ws` (works in local dev via Vite proxy, not on Netlify).

### Netlify frontend URL

https://loquacious-snickerdoodle-bdef32.netlify.app

---

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_WS_URL` | Frontend build | WebSocket URL of deployed backend, e.g. `wss://…/ws`. Optional in dev. |
| `PORT` | Backend runtime | Port to listen on. Defaults to 3001. Railway/Fly inject this automatically. |

---

## Build Commands

```bash
bun run build          # Vite production build → dist/
bun run check          # Lint + typecheck
bun run contracts:build  # forge build
bun run contracts:test   # forge test
```
