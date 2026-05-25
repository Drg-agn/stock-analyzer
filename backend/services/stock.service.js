const axios = require("axios");
const cheerio = require("cheerio");

// ==================== HEADERS ====================
const yahooHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json",
};

const screenerHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Referer: "https://www.screener.in/",
};

// ==================== RATE LIMITING ====================
let lastScrapeTime = 0;
const MIN_SCRAPE_INTERVAL = 2000; // 2 seconds

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== SCRAPE FUNDAMENTALS FROM SCREENER.IN ====================
async function scrapeFundamentals(symbol) {
  // Rate limit
  const now = Date.now();
  if (lastScrapeTime && now - lastScrapeTime < MIN_SCRAPE_INTERVAL) {
    const wait = MIN_SCRAPE_INTERVAL - (now - lastScrapeTime);
    console.log(`⏳ Rate limit: waiting ${wait}ms before scraping ${symbol}`);
    await delay(wait);
  }
  lastScrapeTime = Date.now();

  const url = `https://www.screener.in/company/${symbol.toLowerCase()}/`;
  console.log(`🔍 Scraping ${symbol} from ${url}`);

  try {
    const { data: html } = await axios.get(url, {
      headers: screenerHeaders,
      timeout: 15000,
    });
    const $ = cheerio.load(html);

    let roe = 0, roce = 0, operatingMargin = 0, currentRatio = 0, epsCagr = 0;

    // --- NEW: Scrape ROCE and ROE from the top of the page ---
    // Find the text that contains the metrics
    const topSectionText = $('body').text();
    
    // Extract ROCE (e.g., "ROCE 76.7 %" )
    const roceMatch = topSectionText.match(/ROCE\s*([\d.]+)\s*%/);
    if (roceMatch) roce = parseFloat(roceMatch[1]);

    // Extract ROE (e.g., "ROE 65.2 %" )
    const roeMatch = topSectionText.match(/ROE\s*([\d.]+)\s*%/);
    if (roeMatch) roe = parseFloat(roeMatch[1]);

    // --- Optional: Scrape other metrics from their respective tables (if still needed) ---
    // These selectors might still work for data that isn't locked.
    // If they fail, they will remain as 0, which is acceptable.
    
    // 2. Operating Margin from profit & loss
    const plTable = $('section#profit-loss table.data-table').first();
    if (plTable.length) {
      let revenue = 0, opProfit = 0;
      plTable.find('tr').each((i, row) => {
        const label = $(row).find('td:first-child').text().trim();
        const value = $(row).find('td:last-child').text().trim();
        if (label === 'Revenue') revenue = parseFloat(value.replace(/,/g, '')) || 0;
        if (label === 'Operating Profit') opProfit = parseFloat(value.replace(/,/g, '')) || 0;
      });
      if (revenue > 0) operatingMargin = (opProfit / revenue) * 100;
    }

    // 3. Current Ratio from balance sheet
    const bsTable = $('section#balance-sheet table.data-table').first();
    if (bsTable.length) {
      let currAssets = 0, currLiab = 0;
      bsTable.find('tr').each((i, row) => {
        const label = $(row).find('td:first-child').text().trim();
        const value = $(row).find('td:last-child').text().trim();
        if (label === 'Current Assets') currAssets = parseFloat(value.replace(/,/g, '')) || 0;
        if (label === 'Current Liabilities') currLiab = parseFloat(value.replace(/,/g, '')) || 0;
      });
      if (currLiab > 0) currentRatio = currAssets / currLiab;
    }

    // 4. EPS CAGR from quarterly EPS (latest vs 4 quarters ago)
    const quartersTable = $('section#quarters table.data-table').first();
    if (quartersTable.length) {
      const epsValues = [];
      quartersTable.find('tr').each((i, row) => {
        const label = $(row).find('td:first-child').text().trim();
        if (label === 'EPS') {
          $(row).find('td').each((j, cell) => {
            if (j > 0) {
              const val = parseFloat($(cell).text().trim());
              if (!isNaN(val)) epsValues.push(val);
            }
          });
        }
      });
      if (epsValues.length >= 5) {
        const latest = epsValues[0];
        const older = epsValues[4];
        if (older > 0) epsCagr = ((latest - older) / older) * 100;
      }
    }

    console.log(`✅ Scraped ${symbol}: ROE=${roe.toFixed(1)}%, ROCE=${roce.toFixed(1)}%`);
    return {
      roe: roe.toFixed(1),
      roce: roce.toFixed(1),
      operatingMargin: operatingMargin.toFixed(1),
      currentRatio: currentRatio.toFixed(2),
      epsCagr: epsCagr.toFixed(1),
    };
  } catch (err) {
    console.error(`❌ Scraping failed for ${symbol}:`, err.message);
    return null;
  }
}

// ==================== YAHOO FINANCE HELPERS ====================
// ... (rest of your existing functions remain unchanged: calcSMA, calcEMA, getStockQuote, getNiftyAboveEMA)

function calcSMA(data, period) {
  if (!data || data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcEMA(data, period) {
  if (!data || data.length < period) return null;
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

// ==================== MAIN FUNCTION ====================
async function getStockQuote(symbol) {
  try {
    // 1. Fetch price data from Yahoo Finance
    const ticker = `${symbol}.NS`;
    const priceUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`;
    const priceRes = await axios.get(priceUrl, { headers: yahooHeaders });
    const result = priceRes.data.chart.result[0];
    const meta = result.meta;
    const quote = result.indicators.quote[0];
    const closes = quote.close.filter(Boolean);
    const highs = quote.high.filter(Boolean);
    const lows = quote.low.filter(Boolean);
    const volumes = quote.volume.filter(Boolean);

    const sma20 = calcSMA(closes, 20) || meta.regularMarketPrice;
    const sma50 = calcSMA(closes, 50) || meta.regularMarketPrice;
    const sma200 = calcSMA(closes, 200) || meta.regularMarketPrice * 0.85;
    const ema12 = calcEMA(closes, 12) || meta.regularMarketPrice;
    const ema26 = calcEMA(closes, 26) || meta.regularMarketPrice;
    const avgVol20 = calcSMA(volumes, 20) || 1;
    const todayVol = volumes[volumes.length - 1] || 0;
    const todayHigh = highs[highs.length - 1] || meta.regularMarketPrice;
    const todayLow = lows[lows.length - 1] || meta.regularMarketPrice;

    // 2. Scrape fundamentals from Screener.in (real data or null)
    const fundamentals = await scrapeFundamentals(symbol);
    const fundData = fundamentals || {
      roe: "0.0",
      roce: "0.0",
      operatingMargin: "0.0",
      currentRatio: "0.00",
      epsCagr: "0.0",
    };

    if (!fundamentals) {
      console.log(`⚠️ No real fundamentals for ${symbol}, returning zeros.`);
    }

    return {
      shortName: meta.symbol,
      regularMarketPrice: meta.regularMarketPrice,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      fiftyDayAverage: sma50,
      twoHundredDayAverage: sma200,
      roe: fundData.roe,
      roce: fundData.roce,
      operatingMargin: fundData.operatingMargin,
      currentRatio: fundData.currentRatio,
      epsCagr: fundData.epsCagr,
      macdPositive: ema12 > ema26,
      above20MA: meta.regularMarketPrice > sma20,
      volumeRatio: avgVol20 ? Number((todayVol / avgVol20).toFixed(2)) : 0,
      entryBarSize: Number((((todayHigh - todayLow) / todayLow) * 100).toFixed(1)),
    };
  } catch (err) {
    console.log(`Yahoo error for ${symbol}:`, err.message);
    return null;
  }
}

async function getNiftyAboveEMA() {
  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=6mo";
    const response = await axios.get(url, { headers: yahooHeaders });
    const closes = response.data.chart.result[0].indicators.quote[0].close.filter(Boolean);
    const cmp = closes[closes.length - 1];
    const ema10 = calcEMA(closes, 10);
    const ema20 = calcEMA(closes, 20);
    return cmp > ema10 && cmp > ema20;
  } catch (err) {
    console.log("Nifty error:", err.message);
    return false;
  }
}

module.exports = { getStockQuote, getNiftyAboveEMA };