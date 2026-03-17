# 虛擬股票遊戲 MVP

可在瀏覽器遊玩的模擬股票交易遊戲，**僅使用遊戲幣**。

## TWSE STOCK_DAY 欄位對應（已確認）
`/api/twse/official-close` 使用 TWSE `STOCK_DAY` 的每日資料列 `row`：

- `row[0]`：日期（民國年，例如 `114/03/14`）
- `row[1]`：成交股數
- `row[2]`：成交金額
- `row[3]`：開盤價
- `row[4]`：最高價
- `row[5]`：最低價
- `row[6]`：**收盤價（本專案用於 closePrice）**
- `row[7]`：漲跌價差
- `row[8]`：成交筆數

> 目前官方收盤價對應已修正為 `closePrice`，並同步回傳 `lastPrice` / `previousClose`（皆以當日收盤價填入，供前端相容使用）。

## 功能
- 模擬報價（mock）可單獨遊玩，不依賴任何 API key
- 自動模式（auto）優先走 TWSE 本地 proxy，失敗時自動切回 mock
- 買進 / 賣出、持倉、已實現與未實現損益
- 每日二選一預測（收紅/收黑）與示範結算

## 架構
- `src/providers/marketDataProvider.js`
  - `MarketDataProvider` 基礎介面
  - `MockMarketDataProvider` 模擬報價
  - `FallbackMarketDataProvider`（primary -> fallback）
- `src/providers/taiwanStockProvider.js`
  - `TaiwanTwseMarketDataProvider`（改走本地 proxy）
- `proxy/server.js`
  - `/api/twse/realtime?symbols=...`
  - `/api/twse/official-close?symbol=...&date=...`

### 前端統一報價欄位
- `symbol`
- `name`
- `lastPrice`
- `change`
- `changePercent`
- `previousClose`
- `timestamp`

## 本地執行方式

### 一鍵啟動（Windows）
直接雙擊：
- `啟動遊戲.bat`

它會自動：
- 啟動 proxy
- 啟動前端
- 開啟 `http://localhost:4173/?provider=auto`

若要關閉相關伺服器，可雙擊：
- `關閉遊戲伺服器.bat`

### 手動啟動
請開兩個終端機：

#### 終端機 1：啟動 proxy
```bash
npm run start:proxy
```

#### 終端機 2：啟動前端
```bash
npm run start:frontend
```

開啟：
- `http://localhost:4173/?provider=auto`
- `http://localhost:4173/?provider=mock`

## 本地測試建議
### 1) 即時報價 proxy
```bash
curl "http://localhost:8787/api/twse/realtime?symbols=2330,2317"
```

### 2) 官方收盤 endpoint
```bash
curl "http://localhost:8787/api/twse/official-close?symbol=2330&date=2026-03-13"
```

### 3) 中文介面
開啟前端後確認：
- 標題、按鈕、欄位名稱皆為繁體中文
- 錢包/持倉/損益/交易紀錄/預測與結算文字皆為繁中

## 仍屬 mock 的部分
- `?provider=mock`：永遠使用模擬資料
- `?provider=auto`：若 proxy 或 TWSE 上游不可用，會自動使用 mock 備援，保持可玩
