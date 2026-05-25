// backend/screener-fetcher.mjs
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { ScreenerClient } from 'screener-india';

const client = new ScreenerClient();

// Add as many NSE symbols as you want
const SYMBOLS = [
  "TCS", "INFY", "RELIANCE", "HDFCBANK", "ICICIBANK",
  "SBIN", "BHARTIARTL", "ITC", "HINDUNILVR", "MARUTI",
  "TATAMOTORS", "TATASTEEL", "WIPRO", "HCLTECH", "TECHM",
  "AXISBANK", "KOTAKBANK", "LT", "ASIANPAINT", "NESTLEIND",
  // Add your own:
  "RATNAVEER", "RRKABEL"
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchStockFundamentals(symbol) {
  try {
    console.log(`🔍 Fetching ${symbol}...`);
    const { data } = await client.getCompany(symbol);
    
    // Latest annual ratios (first item in the array)
    const latestRatios = data.ratios?.[0] || {};
    
    // ✅ CORRECT: use the exact keys with "%" and parentheses
    const roe = parseFloat(latestRatios["ROE (%)"]) || 0;
    const roce = parseFloat(latestRatios["ROCE (%)"]) || 0;
    
    // EPS CAGR from quarterly results (4 quarters apart)
    let epsCagr = 0;
    if (data.quarters && data.quarters.length >= 5) {
      const epsValues = data.quarters.map(q => q.earnings_per_share).filter(v => v && !isNaN(v));
      if (epsValues.length >= 5) {
        const latest = epsValues[0];
        const older = epsValues[4];
        if (older > 0) epsCagr = ((latest - older) / older) * 100;
      }
    }
    
    // Current Ratio from balance sheet
    let currentRatio = 0;
    if (data.balance_sheet?.length) {
      const latestBS = data.balance_sheet[0];
      if (latestBS.current_assets && latestBS.current_liabilities && latestBS.current_liabilities !== 0) {
        currentRatio = latestBS.current_assets / latestBS.current_liabilities;
      }
    }
    
    // Operating Margin from profit & loss
    let operatingMargin = 0;
    if (data.profit_loss?.length) {
      const latestPL = data.profit_loss[0];
      if (latestPL.operating_profit && latestPL.revenue && latestPL.revenue !== 0) {
        operatingMargin = (latestPL.operating_profit / latestPL.revenue) * 100;
      }
    }
    
    console.log(`✅ ${symbol}: ROE=${roe.toFixed(1)}%, ROCE=${roce.toFixed(1)}%`);
    return {
      ticker: symbol,
      name: data.name || symbol,
      roe: roe.toFixed(1),
      roce: roce.toFixed(1),
      operatingMargin: operatingMargin.toFixed(1),
      currentRatio: currentRatio.toFixed(2),
      epsCagr: epsCagr.toFixed(1),
      lastUpdated: new Date().toISOString()
    };
  } catch (err) {
    console.error(`❌ Failed for ${symbol}:`, err.message);
    return null;
  }
}

async function main() {
  console.log(`\n🚀 Starting fetch for ${SYMBOLS.length} stocks...\n`);
  const results = [];
  for (const symbol of SYMBOLS) {
    const stockData = await fetchStockFundamentals(symbol);
    if (stockData) results.push(stockData);
    await delay(1500); // polite delay between requests
  }
  
  // Save to data.json
  writeFileSync('data.json', JSON.stringify(results, null, 2));
  console.log(`\n✅ Saved ${results.length} stocks to data.json\n`);
}

main().catch(console.error);