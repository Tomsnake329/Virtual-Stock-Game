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
  return value >= 0 ? 'red' : 'green';
}

function signedFmt(num, suffix = '') {
  const value = Number(num);
  const sign = value > 0 ? '+' : '';
  return `${sign}${fmt(value)}${suffix}`;
}

function providerLabel() {
  if (providerMode === 'mock') {
    return '模擬資料（強制）';
  }
  if (market.lastProviderUsed === 'primary') {
    return 'TWSE 即時資料';
  }
  return '模擬資料備援';
}

function render() {
  const portfolio = trading.getPortfolio(stocks.map((s) => ({ symbol: s.symbol, price: s.lastPrice })));

  portfolioSummary.innerHTML = `
    <h2>錢包與損益</h2>
    <p class="muted">資料來源：${providerLabel()}</p>
    <div class="summary-grid">
      <div>錢包餘額</div><strong>${fmt(portfolio.cash)} 遊戲幣</strong>
      <div>持倉市值</div><strong>${fmt(portfolio.holdingsValue)} 遊戲幣</strong>
      <div>總資產</div><strong>${fmt(portfolio.totalEquity)} 遊戲幣</strong>
      <div>已實現損益</div><strong class="${colorClass(portfolio.realizedPnL)}">${signedFmt(portfolio.realizedPnL)}</strong>
      <div>未實現損益</div><strong class="${colorClass(portfolio.unrealizedPnL)}">${signedFmt(portfolio.unrealizedPnL)}</strong>
      <div>總損益</div><strong class="${colorClass(portfolio.totalPnL)}">${signedFmt(portfolio.totalPnL)}</strong>
    </div>
  `;

  stockBody.innerHTML = stocks
    .map(
      (s) => `
      <tr>
        <td class="symbol-cell">${s.symbol}</td>
        <td class="name-cell">${s.name}</td>
        <td class="number-cell">${fmt(s.lastPrice)}</td>
        <td class="number-cell ${colorClass(s.change)}">${signedFmt(s.change)}</td>
        <td class="number-cell ${colorClass(s.changePercent)}">${signedFmt(s.changePercent, '%')}</td>
        <td class="time-cell">${new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
        <td class="action-cell"><button data-symbol="${s.symbol}" class="quick-buy">買 1 股</button></td>
      </tr>
    `
    )
    .join('');

  holdingsBody.innerHTML =
    portfolio.holdings.length === 0
      ? '<tr><td colspan="5" class="muted">目前沒有持倉。</td></tr>'
      : portfolio.holdings
          .map(
            (h) => `
          <tr>
            <td class="symbol-cell">${h.symbol}</td>
            <td class="number-cell">${h.quantity}</td>
            <td class="number-cell">${fmt(h.avgCost)}</td>
            <td class="number-cell">${fmt(h.marketValue)}</td>
            <td class="number-cell ${colorClass(h.unrealizedPnL)}">${signedFmt(h.unrealizedPnL)}</td>
          </tr>
        `
          )
          .join('');

  tradeHistoryBody.innerHTML =
    portfolio.tradeHistory.length === 0
      ? '<tr><td colspan="6" class="muted">尚無交易紀錄。</td></tr>'
      : portfolio.tradeHistory
          .map(
            (t) => `
        <tr>
          <td class="time-cell">${new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
          <td>${t.side === 'buy' ? '買進' : '賣出'}</td>
          <td class="symbol-cell">${t.symbol}</td>
          <td class="number-cell">${t.quantity}</td>
          <td class="number-cell">${fmt(t.price)}</td>
          <td class="number-cell">${fmt(t.total)}</td>
        </tr>
      `
          )
          .join('');

  const tsmc = stocks.find((s) => s.symbol === '2330') ?? stocks[0];
  predictionQuestion.textContent = tsmc
    ? `${tsmc.name}（${tsmc.symbol}）今天會收紅還是收黑？昨日收盤：${fmt(tsmc.previousClose)}`
    : '市場資料載入中，請稍候…';

  const latestSettled = predictions.settledBets[0];
  predictionStatus.innerHTML = `
    <div>目前有效預測：${predictions.activeBets.length} 筆</div>
    <div class="muted">結算優先使用 TWSE 官方收盤；若無法取得則退回當前報價。</div>
    ${
      latestSettled
        ? `<div>最近一次結算：${latestSettled.symbol} ${
            latestSettled.outcome === 'red' ? '收紅' : '收黑'
          }；你${latestSettled.won ? '獲勝' : '失敗'} ${fmt(Math.abs(latestSettled.profit))} 遊戲幣。</div>`
        : '<div>尚未有結算紀錄。</div>'
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
    tradeFeedback.textContent = '目前報價中找不到該股票代號。';
    return;
  }
  const result = trading.executeTrade({ side, symbol, quantity, price: stock.lastPrice });
  tradeFeedback.textContent = result.ok ? `委託成功：${result.message}` : `委託失敗：${result.message}`;
  render();
});

stockBody.addEventListener('click', (event) => {
  const btn = event.target.closest('.quick-buy');
  if (!btn) return;
  const symbol = btn.dataset.symbol;
  const stock = stocks.find((s) => s.symbol === symbol);
  if (!stock) return;
  const result = trading.executeTrade({ side: 'buy', symbol, quantity: 1, price: stock.lastPrice });
  tradeFeedback.textContent = result.ok ? `委託成功：${result.message}` : `委託失敗：${result.message}`;
  render();
});

predictionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const tsmc = stocks.find((s) => s.symbol === '2330') ?? stocks[0];
  if (!tsmc) {
    predictionStatus.textContent = '尚未取得市場資料，請稍後再試。';
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

  predictionStatus.textContent = result.ok ? `預測送出：${result.message}` : `預測失敗：${result.message}`;
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
    ? `已結算 ${settlements.length} 筆預測，總派彩：${fmt(payout)} 遊戲幣。`
    : '目前沒有可結算的預測。';
  render();
});

async function init() {
  try {
    await refreshMarket({ initial: true });
    setInterval(() => {
      refreshMarket().catch((error) => {
        console.error('市場更新失敗', error);
      });
    }, 3000);
  } catch (error) {
    tradeFeedback.textContent = `市場初始化失敗：${error.message}`;
  }
}

init();
