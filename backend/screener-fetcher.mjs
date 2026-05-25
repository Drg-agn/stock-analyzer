// backend/screener-fetcher.mjs
import { writeFileSync, existsSync, readFileSync } from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';

// List of NSE symbols you want to track
const SYMBOLS = [
  "TCS", "INFY", "RELIANCE", "HDFCBANK", "ICICIBANK",
  "SBIN", "BHARTIARTL", "ITC", "HINDUNILVR", "MARUTI",
  "TATAMOTORS", "TATASTEEL", "WIPRO", "HCLTECH", "TECHM",
  "AXISBANK", "KOTAKBANK", "LT", "ASIANPAINT", "NESTLEIND",
  // Add your own stocks below:
  "RATNAVEER", "RRKABEL"
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch and parse a single stock page
async function fetchStockFundamentals(symbol) {
  const url = `https://www.screener.in/company/${symbol.toLowerCase()}/`;
  console.log(`🔍 Scraping ${symbol}...`);

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      timeout: 15000,
    });
    const $ = cheerio.load(html);

    // 1. ROE & ROCE from the "ratios" table (usually the last table)
    let roe = 0, roce = 0;
    const ratiosTable = $('section#ratios table.data-table').first();
    if (ratiosTable.length) {
      ratiosTable.find('tr').each((i, row) => {
        const label = $(row).find('td:first-child').text().trim();
        const value = $(row).find('td:last-child').text().trim();
        if (label === 'ROE (%)') roe = parseFloat(value) || 0;
        if (label === 'ROCE (%)') roce = parseFloat(value) || 0;
      });
    }

    // 2. Operating Margin from Profit & Loss statement (latest year)
    let operatingMargin = 0;
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

    // 3. Current Ratio from Balance Sheet
    let currentRatio = 0;
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

    // 4. EPS CAGR from quarterly results (latest vs 4 quarters ago)
    let epsCagr = 0;
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

    console.log(`✅ ${symbol}: ROE=${roe.toFixed(1)}%, ROCE=${roce.toFixed(1)}%`);
    return {
      ticker: symbol,
      name: $('h1[itemprop="name"]').first().text().trim() || symbol,
      roe: roe.toFixed(1),
      roce: roce.toFixed(1),
      operatingMargin: operatingMargin.toFixed(1),
      currentRatio: currentRatio.toFixed(2),
      epsCagr: epsCagr.toFixed(1),
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`❌ Failed for ${symbol}:`, err.message);
    return null;
  }
}

async function main() {
  console.log(`\n🚀 Starting scrape for ${SYMBOLS.length} stocks...\n`);
  const results = [];
  for (const symbol of SYMBOLS) {
    const stockData = await fetchStockFundamentals(symbol);
    if (stockData) results.push(stockData);
    await delay(2000); // 2 seconds delay to be polite
  }

  // Load existing data to merge (optional)
  let existing = [];
  if (existsSync('data.json')) {
    existing = JSON.parse(readFileSync('data.json', 'utf8'));
  }
  const merged = [...existing.filter(e => !results.some(r => r.ticker === e.ticker)), ...results];
  merged.sort((a,b) => a.ticker.localeCompare(b.ticker));

  writeFileSync('data.json', JSON.stringify(merged, null, 2));
  console.log(`\n✅ Saved ${merged.length} stocks to data.json\n`);
}

main().catch(console.error);