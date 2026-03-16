export class MarketDataProvider {
  async getSnapshot() {
    throw new Error('Not implemented');
  }

  async tick() {
    return this.getSnapshot();
  }

  async getOfficialClose() {
    throw new Error('Official close lookup not implemented');
  }
}

function normalizeQuote(raw) {
  return {
    symbol: raw.symbol,
    name: raw.name,
    lastPrice: Number(raw.lastPrice),
    change: Number(raw.change),
    changePercent: Number(raw.changePercent),
    previousClose: Number(raw.previousClose),
    timestamp: raw.timestamp || new Date().toISOString()
  };
}

export class MockMarketDataProvider extends MarketDataProvider {
  constructor() {
    super();
    this.stocks = [
      { symbol: '2330', name: 'TSMC', lastPrice: 620, previousClose: 615 },
      { symbol: '2317', name: 'Hon Hai', lastPrice: 132, previousClose: 131.5 },
      { symbol: '2454', name: 'MediaTek', lastPrice: 1180, previousClose: 1172 },
      { symbol: '2882', name: 'Cathay FHC', lastPrice: 59, previousClose: 58.7 }
    ];
  }

  async getSnapshot() {
    return this.stocks.map((s) => {
      const change = s.lastPrice - s.previousClose;
      return normalizeQuote({
        ...s,
        change,
        changePercent: (change / s.previousClose) * 100
      });
    });
  }

  async tick() {
    this.stocks = this.stocks.map((stock) => {
      const drift = (Math.random() - 0.5) * stock.lastPrice * 0.01;
      const nextPrice = Math.max(1, stock.lastPrice + drift);
      return {
        ...stock,
        lastPrice: Number(nextPrice.toFixed(2))
      };
    });
    return this.getSnapshot();
  }

  async getOfficialClose(symbol) {
    const stock = this.stocks.find((s) => s.symbol === symbol);
    return {
      symbol,
      closePrice: stock?.lastPrice ?? 0,
      timestamp: new Date().toISOString(),
      source: 'mock',
      isOfficial: false
    };
  }
}

export class FallbackMarketDataProvider extends MarketDataProvider {
  constructor({ primary, fallback }) {
    super();
    this.primary = primary;
    this.fallback = fallback;
    this.lastProviderUsed = 'fallback';
  }

  async getSnapshot() {
    try {
      const data = await this.primary.getSnapshot();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Primary provider returned empty snapshot.');
      }
      this.lastProviderUsed = 'primary';
      return data;
    } catch (error) {
      console.warn('Primary market provider failed; using mock fallback.', error);
      this.lastProviderUsed = 'fallback';
      return this.fallback.getSnapshot();
    }
  }

  async tick() {
    if (this.lastProviderUsed === 'primary') {
      try {
        return await this.primary.tick();
      } catch (error) {
        this.lastProviderUsed = 'fallback';
        return this.fallback.tick();
      }
    }
    return this.getSnapshot();
  }

  async getOfficialClose(symbol, dateKey) {
    if (this.lastProviderUsed === 'primary') {
      try {
        return await this.primary.getOfficialClose(symbol, dateKey);
      } catch (error) {
        console.warn('Primary official close lookup failed; using mock close.', error);
      }
    }
    return this.fallback.getOfficialClose(symbol, dateKey);
  }
}
