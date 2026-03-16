import { FallbackMarketDataProvider, MockMarketDataProvider } from './providers/marketDataProvider.js';
import { TaiwanTwseMarketDataProvider } from './providers/taiwanStockProvider.js';
import { TradingEngine } from './game/tradingEngine.js';
import { PredictionEngine } from './game/predictionEngine.js';

const providerMode = new URLSearchParams(window.location.search).get('provider') || 'auto';
const primaryProvider = new TaiwanTwseMarketDataProvider();
const fallbackProvider = new MockMarketDataProvider();

const market =
  providerMode === 'mock'
    ? fallbackProvider
    : new FallbackMarketDataProvider({
        primary: primaryProvider,
        fallback: fallbackProvider
      });

const trading = new TradingEngine({ startingCash: 100000 });
const predictions = new PredictionEngine({ rewardMultiplier: 1.9 });

const portfolioSummary = document.querySelector('#portfolio-summary');
const stockBody = document.querySelector('#stock-table-body');
const holdingsBody = document.querySelector('#holdings-body');
const tradeHistoryBody = document.querySelector('#trade-history-body');
const tradeForm = document.querySelector('#trade-form');
const tradeSymbolSelect = document.querySelector('#trade-symbol');
const tradeFeedback = document.querySelector('#trade-feedback');
const predictionQuestion = document.querySelector('#prediction-question');
const predictionForm = document.querySelector('#prediction-form');
const predictionStatus = document.querySelector('#prediction-status');
const settleButton = document.querySelector('#settle-day');

let stocks = [];

function fmt(num) {
  return Number(num).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function colorClass(value) {
  return value >= 0 ? 'green' : 'red';
}

function providerLabel() {
  if (providerMode === 'mock') {
    return 'mock (forced)';
  }
  if (market.lastProviderUsed === 'primary') {
    return 'TWSE primary';
  }
  return 'mock fallback';
}

function render() {
  const portfolio = trading.getPortfolio(stocks.map((s) => ({ symbol: s.symbol, price: s.lastPrice })));

  portfolioSummary.innerHTML = `
    <h2>Wallet & P&L</h2>
    <p class="muted">Data provider: ${providerLabel()}</p>
    <div class="summary-grid">
      <div>Wallet</div><strong>${fmt(portfolio.cash)} coins</strong>
      <div>Holdings Value</div><strong>${fmt(portfolio.holdingsValue)} coins</strong>
      <div>Total Equity</div><strong>${fmt(portfolio.totalEquity)} coins</strong>
      <div>Realized P&L</div><strong class="${colorClass(portfolio.realizedPnL)}">${fmt(portfolio.realizedPnL)}</strong>
      <div>Unrealized P&L</div><strong class="${colorClass(portfolio.unrealizedPnL)}">${fmt(portfolio.unrealizedPnL)}</strong>
      <div>Total P&L</div><strong class="${colorClass(portfolio.totalPnL)}">${fmt(portfolio.totalPnL)}</strong>
    </div>
  `;

  stockBody.innerHTML = stocks
    .map(
      (s) => `
      <tr>
        <td>${s.symbol}</td>
        <td>${s.name}</td>
        <td>${fmt(s.lastPrice)}</td>
        <td class="${colorClass(s.change)}">${fmt(s.change)}</td>
        <td class="${colorClass(s.changePercent)}">${fmt(s.changePercent)}%</td>
        <td>${new Date(s.timestamp).toLocaleTimeString()}</td>
        <td><button data-symbol="${s.symbol}" class="quick-buy">Buy 1</button></td>
      </tr>
    `
    )
    .join('');

  holdingsBody.innerHTML =
    portfolio.holdings.length === 0
      ? '<tr><td colspan="5" class="muted">No holdings yet.</td></tr>'
      : portfolio.holdings
          .map(
            (h) => `
          <tr>
            <td>${h.symbol}</td>
            <td>${h.quantity}</td>
            <td>${fmt(h.avgCost)}</td>
            <td>${fmt(h.marketValue)}</td>
            <td class="${colorClass(h.unrealizedPnL)}">${fmt(h.unrealizedPnL)}</td>
          </tr>
        `
          )
          .join('');

  tradeHistoryBody.innerHTML =
    portfolio.tradeHistory.length === 0
      ? '<tr><td colspan="6" class="muted">No trades yet.</td></tr>'
      : portfolio.tradeHistory
          .map(
            (t) => `
        <tr>
          <td>${new Date(t.timestamp).toLocaleTimeString()}</td>
          <td>${t.side.toUpperCase()}</td>
          <td>${t.symbol}</td>
          <td>${t.quantity}</td>
          <td>${fmt(t.price)}</td>
          <td>${fmt(t.total)}</td>
        </tr>
      `
          )
          .join('');

  const tsmc = stocks.find((s) => s.symbol === '2330') ?? stocks[0];
  predictionQuestion.textContent = tsmc
    ? `Will ${tsmc.name} (${tsmc.symbol}) close red or green today? Previous close: ${fmt(tsmc.previousClose)}`
    : 'Loading prediction symbol...';

  const latestSettled = predictions.settledBets[0];
  predictionStatus.innerHTML = `
    <div>Active bets: ${predictions.activeBets.length}</div>
    <div class="muted">Settlement target: official TWSE close (currently fallback to available market close if unavailable).</div>
    ${
      latestSettled
        ? `<div>Last settlement: ${latestSettled.symbol} closed ${latestSettled.outcome}; you ${
            latestSettled.won ? 'won' : 'lost'
          } ${fmt(Math.abs(latestSettled.profit))} coins.</div>`
        : '<div>No settlement yet.</div>'
    }
  `;
}

function fillSymbolDropdown() {
  tradeSymbolSelect.innerHTML = stocks
    .map((s) => `<option value="${s.symbol}">${s.symbol} - ${s.name}</option>`)
    .join('');
}

async function refreshMarket({ initial = false } = {}) {
  stocks = initial ? await market.getSnapshot() : await market.tick();
  if (initial) {
    fillSymbolDropdown();
  }
  render();
}

tradeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(tradeForm);
  const symbol = formData.get('symbol');
  const side = formData.get('side');
  const quantity = Number(formData.get('quantity'));
  const stock = stocks.find((s) => s.symbol === symbol);
  if (!stock) {
    tradeFeedback.textContent = 'Symbol not found in current market snapshot.';
    return;
  }
  const result = trading.executeTrade({ side, symbol, quantity, price: stock.lastPrice });
  tradeFeedback.textContent = result.message;
  render();
});

stockBody.addEventListener('click', (event) => {
  const btn = event.target.closest('.quick-buy');
  if (!btn) return;
  const symbol = btn.dataset.symbol;
  const stock = stocks.find((s) => s.symbol === symbol);
  if (!stock) return;
  const result = trading.executeTrade({ side: 'buy', symbol, quantity: 1, price: stock.lastPrice });
  tradeFeedback.textContent = result.message;
  render();
});

predictionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const tsmc = stocks.find((s) => s.symbol === '2330') ?? stocks[0];
  if (!tsmc) {
    predictionStatus.textContent = 'No market data yet. Try again after snapshot loads.';
    return;
  }

  const formData = new FormData(predictionForm);
  const pick = formData.get('prediction');
  const wager = Number(formData.get('wager'));

  const result = predictions.placeBet({
    symbol: tsmc.symbol,
    pick,
    wager,
    openPrice: tsmc.previousClose,
    walletCash: trading.cash
  });

  if (result.ok) {
    trading.cash -= wager;
  }

  predictionStatus.textContent = result.message;
  render();
});

settleButton.addEventListener('click', async () => {
  const closePrices = new Map();

  for (const bet of predictions.activeBets) {
    try {
      const official = await market.getOfficialClose(bet.symbol);
      closePrices.set(bet.symbol, official.closePrice);
    } catch (error) {
      const latest = stocks.find((s) => s.symbol === bet.symbol);
      if (latest) {
        closePrices.set(bet.symbol, latest.lastPrice);
      }
    }
  }

  const settlements = predictions.settleAll(closePrices);
  const payout = settlements.reduce((sum, s) => sum + s.payout, 0);
  trading.cash += payout;
  predictionStatus.textContent = settlements.length
    ? `Settled ${settlements.length} bet(s). Total payout: ${fmt(payout)} coins.`
    : 'No active bets to settle.';
  render();
});

async function init() {
  try {
    await refreshMarket({ initial: true });
    setInterval(() => {
      refreshMarket().catch((error) => {
        console.error('Market refresh failed', error);
      });
    }, 3000);
  } catch (error) {
    tradeFeedback.textContent = `Market initialization failed: ${error.message}`;
  }
}

init();
