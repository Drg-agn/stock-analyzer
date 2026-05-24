const axios = require("axios");

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json",
};

// EMA
function calcEMA(data, period) {
  if (data.length < period) return null;

  const k = 2 / (period + 1);

  let ema =
    data.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }

  return ema;
}

// SMA
function calcSMA(data, period) {
  if (data.length < period) return null;

  const slice = data.slice(-period);

  return slice.reduce((a, b) => a + b, 0) / period;
}

async function getStockQuote(symbol) {
  try {
    const ticker = `${symbol}.NS`;

    // ONLY chart endpoint
    // this avoids Yahoo 401
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}` +
      `?interval=1d&range=1y`;

    const response = await axios.get(url, { headers });

    const result = response.data.chart.result[0];

    const meta = result.meta;

    const quote = result.indicators.quote[0];

    const closes = quote.close.filter(Boolean);
    const highs = quote.high.filter(Boolean);
    const lows = quote.low.filter(Boolean);
    const volumes = quote.volume.filter(Boolean);

    const sma20 = calcSMA(closes, 20);
    const sma50 = calcSMA(closes, 50);
    const sma200 = calcSMA(closes, 200);

    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);

    const avgVol20 = calcSMA(volumes, 20);

    const todayVol = volumes[volumes.length - 1];

    const todayHigh = highs[highs.length - 1];
    const todayLow = lows[lows.length - 1];

    return {
      shortName: meta.symbol,

      regularMarketPrice:
        meta.regularMarketPrice,

      fiftyTwoWeekHigh:
        meta.fiftyTwoWeekHigh,

      fiftyTwoWeekLow:
        meta.fiftyTwoWeekLow,

      fiftyDayAverage: sma50,

      twoHundredDayAverage: sma200,

      // FUNDAMENTALS unavailable from free chart API
      roe: null,
      roce: null,
      currentRatio: null,
      operatingMargin: null,
      epsCagr: null,

      // MOMENTUM
      macdPositive: ema12 > ema26,

      above20MA:
        meta.regularMarketPrice > sma20,

      volumeRatio:
        avgVol20
          ? Number((todayVol / avgVol20).toFixed(2))
          : 0,

      entryBarSize:
        Number(
          (
            ((todayHigh - todayLow) / todayLow) *
            100
          ).toFixed(1)
        ),
    };
  } catch (err) {
    console.log("Stock fetch error:", symbol);

    console.log(err.message);

    return null;
  }
}

// NIFTY EMA
async function getNiftyAboveEMA() {
  try {
    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=6mo";

    const response = await axios.get(url, {
      headers,
    });

    const quote =
      response.data.chart.result[0]
        .indicators.quote[0];

    const closes = quote.close.filter(Boolean);

    const cmp = closes[closes.length - 1];

    const ema10 = calcEMA(closes, 10);
    const ema20 = calcEMA(closes, 20);

    return cmp > ema10 && cmp > ema20;
  } catch (err) {
    console.log("Nifty Error");

    return false;
  }
}

module.exports = {
  getStockQuote,
  getNiftyAboveEMA,
};