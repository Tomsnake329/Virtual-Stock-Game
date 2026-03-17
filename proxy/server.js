import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const latestTradeCache = new Map();

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function normalizeQuote(row) {
  const symbol = row.c;
  const name = row.n;
  const previousClose = Number(row.y);
  const rawTradePrice = row.z;
  const hasLiveTradePrice = rawTradePrice && rawTradePrice !== '-';
  const cachedLastPrice = latestTradeCache.get(symbol);
  const lastPrice = hasLiveTradePrice ? Number(rawTradePrice) : cachedLastPrice ?? previousClose;

  if (Number.isFinite(lastPrice)) {
    latestTradeCache.set(symbol, lastPrice);
  }

  const change = lastPrice - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;
  const timestamp = row.tlong ? new Date(Number(row.tlong)).toISOString() : new Date().toISOString();

  return {
    symbol,
    name,
    lastPrice,
    change,
    changePercent,
    previousClose,
    timestamp,
    marketStatus: hasLiveTradePrice ? 'live' : cachedLastPrice != null ? 'stale' : 'reference',
    marketStatusLabel: hasLiveTradePrice ? '剛成交' : cachedLastPrice != null ? '沿用前筆' : '參考昨收'
  };
}

function parseDateToTwseMonth(dateKey) {
  return (dateKey || new Date().toISOString().slice(0, 10)).replace(/-/g, '').slice(0, 6) + '01';
}

function parseRocDateToAd(rocDate) {
  const [rocYear, month, day] = rocDate.split('/').map(Number);
  return `${rocYear + 1911}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    return json(res, 400, { error: 'Invalid request URL.' });
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname === '/api/twse/realtime' && req.method === 'GET') {
      const symbolsParam = url.searchParams.get('symbols') || '2330,2317,2454,2882,2303,2603,1301,1303,2002,2891';
      const symbols = symbolsParam
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const exCh = symbols.map((s) => `tse_${s}.tw`).join('|');
      const upstreamUrl = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${encodeURIComponent(exCh)}&json=1&delay=0&_=${Date.now()}`;

      const upstream = await fetch(upstreamUrl);
      if (!upstream.ok) {
        return json(res, 502, { error: `TWSE realtime upstream failed: ${upstream.status}` });
      }
      const payload = await upstream.json();
      const quotes = (payload.msgArray || []).map(normalizeQuote);
      return json(res, 200, { quotes, source: 'twse-mis' });
    }

    if (url.pathname === '/api/twse/official-close' && req.method === 'GET') {
      const symbol = url.searchParams.get('symbol');
      const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
      if (!symbol) {
        return json(res, 400, { error: 'Missing required query: symbol' });
      }

      const monthKey = parseDateToTwseMonth(date);
      const upstreamUrl = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${monthKey}&stockNo=${encodeURIComponent(symbol)}`;
      const upstream = await fetch(upstreamUrl);
      if (!upstream.ok) {
        return json(res, 502, { error: `TWSE official-close upstream failed: ${upstream.status}` });
      }

      const payload = await upstream.json();
      const row = (payload.data || []).find((item) => parseRocDateToAd(item[0]) === date);
      if (!row) {
        return json(res, 404, { error: `No close data for symbol ${symbol} on ${date}` });
      }

      const closePrice = Number(String(row[6]).replace(/,/g, ''));
      const quoteTime = new Date(`${date}T13:30:00+08:00`).toISOString();
      return json(res, 200, {
        symbol,
        name: symbol,
        lastPrice: closePrice,
        change: 0,
        changePercent: 0,
        previousClose: closePrice,
        timestamp: quoteTime,
        closePrice,
        source: 'twse-STOCK_DAY',
        isOfficial: true
      });
    }

    return json(res, 404, { error: 'Route not found.' });
  } catch (error) {
    return json(res, 500, {
      error: error.message || 'Unexpected proxy error.',
      details: error.cause?.message || null
    });
  }
});

server.listen(PORT, () => {
  console.log(`TWSE proxy listening on http://localhost:${PORT}`);
});
