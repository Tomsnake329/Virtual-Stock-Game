import { MarketDataProvider } from './marketDataProvider.js';

export class TaiwanTwseMarketDataProvider extends MarketDataProvider {
  constructor({
    symbols = ['2330', '2317', '2454', '2882'],
    proxyBaseUrl = 'http://localhost:8787'
  } = {}) {
    super();
    this.symbols = symbols;
    this.proxyBaseUrl = proxyBaseUrl.replace(/\/$/, '');
  }

  async getSnapshot() {
    const symbolsParam = this.symbols.join(',');
    const response = await fetch(`${this.proxyBaseUrl}/api/twse/realtime?symbols=${encodeURIComponent(symbolsParam)}`);
    if (!response.ok) {
      throw new Error(`Proxy realtime request failed: ${response.status}`);
    }

    const payload = await response.json();
    const quotes = payload.quotes || [];
    if (quotes.length === 0) {
      throw new Error('Proxy returned empty quote array.');
    }

    return quotes;
  }

  async tick() {
    return this.getSnapshot();
  }

  async getOfficialClose(symbol, dateKey) {
    const query = new URLSearchParams({ symbol });
    if (dateKey) {
      query.set('date', dateKey);
    }

    const response = await fetch(`${this.proxyBaseUrl}/api/twse/official-close?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`Proxy official-close request failed: ${response.status}`);
    }

    return response.json();
  }
}
