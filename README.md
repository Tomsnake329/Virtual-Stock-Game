# Virtual Stock Game MVP

Browser-playable simulated stock trading game using **in-game currency only**.

## Recommended first Taiwan stock data source
**TWSE public endpoints (MIS realtime + TWSE official daily report)** are the best first integration target.

Why this is the best first step:
- No API key required for early integration/prototyping.
- Native Taiwan exchange data shape (easy mapping for 2330/2317/etc.).
- Supports both near-realtime quote pull and official daily close retrieval.
- Lets us ship now with fallback behavior and switch to stricter/paid providers later if needed.

## Features
- Mock market data stream fallback (no API key needed)
- First real-data adapter for Taiwan stocks (TWSE)
- Small local proxy to avoid browser-side TWSE CORS failures
- Buy/sell flow with wallet checks, holdings updates, and trade history
- Portfolio metrics: wallet, holdings value, realized/unrealized/total P&L
- Daily binary prediction bet:
  - Example prompt: "Will TSMC (2330) close red or green today?"
  - Place wager in coins
  - Settlement path designed to use official close data

## Market data architecture
- `src/providers/marketDataProvider.js`
  - `MarketDataProvider` base interface
  - `MockMarketDataProvider` fallback implementation
  - `FallbackMarketDataProvider` wrapper (`primary -> fallback`)
- `src/providers/taiwanStockProvider.js`
  - `TaiwanTwseMarketDataProvider` (now reads through local proxy)
- `proxy/server.js`
  - local proxy routes:
    - `/api/twse/realtime?symbols=...`
    - `/api/twse/official-close?symbol=...&date=...`

### Quote fields required by game
Each provider returns this normalized quote shape:
- `symbol`
- `name`
- `lastPrice`
- `change`
- `changePercent`
- `previousClose`
- `timestamp`

## Provider switching
Use URL query parameter:
- `?provider=auto` (default): try TWSE provider first, fallback to mock if unavailable
- `?provider=mock`: force mock provider only

## Run locally
Open two terminals in project root.

### Terminal 1: start proxy
```bash
npm run start:proxy
```

### Terminal 2: start frontend
```bash
npm run start:frontend
```

Then open:
- `http://localhost:4173/?provider=auto`
- or `http://localhost:4173/?provider=mock`

## Prediction settlement path
The UI currently settles with:
1. `market.getOfficialClose(symbol)` (through proxy in auto mode)
2. fallback to current snapshot price if official close lookup is unavailable

This keeps gameplay unblocked while preparing for official-close settlement in production.

## What remains mock
- `?provider=mock` always uses simulated quotes.
- In `?provider=auto`, if proxy or TWSE upstream is down, app transparently falls back to mock data.
