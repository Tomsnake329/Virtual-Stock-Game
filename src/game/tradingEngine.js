export class TradingEngine {
  constructor({ startingCash = 100000 } = {}) {
    this.cash = startingCash;
    this.holdings = new Map();
    this.history = [];
    this.realizedPnL = 0;
  }

  executeTrade({ side, symbol, quantity, price }) {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, message: 'Quantity must be a positive number.' };
    }

    const total = Number((qty * price).toFixed(2));
    const position = this.holdings.get(symbol) || { quantity: 0, avgCost: 0 };

    if (side === 'buy') {
      if (this.cash < total) {
        return { ok: false, message: 'Insufficient in-game wallet balance.' };
      }
      const newQty = position.quantity + qty;
      const weightedCost = position.quantity * position.avgCost + total;
      position.quantity = newQty;
      position.avgCost = weightedCost / newQty;
      this.cash -= total;
    } else if (side === 'sell') {
      if (position.quantity < qty) {
        return { ok: false, message: 'Cannot sell more than your holdings.' };
      }
      const costBasis = qty * position.avgCost;
      this.realizedPnL += total - costBasis;
      position.quantity -= qty;
      this.cash += total;
      if (position.quantity === 0) {
        position.avgCost = 0;
      }
    } else {
      return { ok: false, message: 'Invalid trade side.' };
    }

    if (position.quantity > 0) {
      this.holdings.set(symbol, position);
    } else {
      this.holdings.delete(symbol);
    }

    this.history.unshift({
      timestamp: new Date().toISOString(),
      side,
      symbol,
      quantity: qty,
      price,
      total
    });

    return { ok: true, message: `${side.toUpperCase()} ${qty} ${symbol} @ ${price.toFixed(2)}` };
  }

  getPortfolio(stocks) {
    const priceMap = new Map(stocks.map((s) => [s.symbol, s.price]));
    const holdings = Array.from(this.holdings.entries()).map(([symbol, pos]) => {
      const marketPrice = priceMap.get(symbol) ?? pos.avgCost;
      const marketValue = marketPrice * pos.quantity;
      const unrealizedPnL = (marketPrice - pos.avgCost) * pos.quantity;
      return {
        symbol,
        quantity: pos.quantity,
        avgCost: pos.avgCost,
        marketValue,
        unrealizedPnL
      };
    });
    const holdingsValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const unrealizedPnL = holdings.reduce((sum, h) => sum + h.unrealizedPnL, 0);
    const totalEquity = this.cash + holdingsValue;

    return {
      cash: this.cash,
      holdings,
      holdingsValue,
      unrealizedPnL,
      realizedPnL: this.realizedPnL,
      totalPnL: this.realizedPnL + unrealizedPnL,
      totalEquity,
      tradeHistory: this.history.slice(0, 20)
    };
  }
}
