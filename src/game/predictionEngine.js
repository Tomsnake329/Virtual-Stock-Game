export class PredictionEngine {
  constructor({ rewardMultiplier = 1.9 } = {}) {
    this.rewardMultiplier = rewardMultiplier;
    this.activeBets = [];
    this.settledBets = [];
  }

  placeBet({ symbol, pick, wager, openPrice, walletCash }) {
    const amount = Number(wager);
    if (!['red', 'green'].includes(pick)) {
      return { ok: false, message: 'Prediction must be red or green.' };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, message: 'Wager must be positive.' };
    }
    if (walletCash < amount) {
      return { ok: false, message: 'Not enough wallet balance for wager.' };
    }

    this.activeBets.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      symbol,
      pick,
      wager: amount,
      openPrice
    });

    return { ok: true, message: `Bet placed: ${symbol} closes ${pick}.` };
  }

  settleAll(closePrices) {
    const results = [];
    for (const bet of this.activeBets) {
      const close = closePrices.get(bet.symbol);
      if (typeof close !== 'number') {
        continue;
      }
      const outcome = close >= bet.openPrice ? 'green' : 'red';
      const won = outcome === bet.pick;
      const payout = won ? bet.wager * this.rewardMultiplier : 0;
      const profit = payout - bet.wager;
      const settled = { ...bet, closePrice: close, outcome, won, payout, profit };
      this.settledBets.unshift(settled);
      results.push(settled);
    }
    this.activeBets = [];
    return results;
  }
}
