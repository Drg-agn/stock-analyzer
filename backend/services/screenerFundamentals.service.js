// backend/services/screenerFundamentals.service.js
const { ScreenerScraperPro } = require("screener-scraper-pro");

/**
 * Fetches key financial ratios (ROE, ROCE) and other fundamentals
 * from Screener.in for a given NSE stock symbol.
 * @param {string} symbol - The NSE stock symbol (e.g., 'TCS').
 * @returns {Promise<object|null>} - Returns an object with the data or null if an error occurs.
 */
async function getFundamentalsFromScreener(symbol) {
    if (!symbol) {
        console.error('Screener: No symbol provided.');
        return null;
    }

    // Construct the URL (using uppercase for reliability)
    const url = `https://www.screener.in/company/${symbol.toUpperCase()}/`;
    console.log(`Screener: Scraping data for ${symbol} from ${url}`);

    try {
        // The library handles the scraping and parsing
        const data = await ScreenerScraperPro(url);

        // --- Robust Data Extraction with Fallbacks ---
        let roe = 0, roce = 0, operatingMargin = 0, currentRatio = 0, epsCagr = 0;

        // 1. Extract ROE & ROCE
        if (data.ratios?.data) {
            const latestYear = Object.keys(data.ratios.data).pop();
            if (latestYear) {
                roe = parseFloat(data.ratios.data[latestYear]['ROE (%)'] || 0);
                roce = parseFloat(data.ratios.data[latestYear]['ROCE (%)'] || 0);
            }
        }

        // 2. Estimate Operating Margin
        if (data.profitLoss?.data) {
            const latestYear = Object.keys(data.profitLoss.data).pop();
            if (latestYear && data.profitLoss.data[latestYear]['Operating Profit'] && data.profitLoss.data[latestYear]['Revenue']) {
                const opProfit = parseFloat(data.profitLoss.data[latestYear]['Operating Profit']);
                const revenue = parseFloat(data.profitLoss.data[latestYear]['Revenue']);
                if (revenue > 0) operatingMargin = (opProfit / revenue) * 100;
            }
        }

        // 3. Calculate Current Ratio
        if (data.balanceSheet?.data) {
            const latestYear = Object.keys(data.balanceSheet.data).pop();
            if (latestYear && data.balanceSheet.data[latestYear]['Current Assets'] && data.balanceSheet.data[latestYear]['Current Liabilities']) {
                const ca = parseFloat(data.balanceSheet.data[latestYear]['Current Assets']);
                const cl = parseFloat(data.balanceSheet.data[latestYear]['Current Liabilities']);
                if (cl > 0) currentRatio = ca / cl;
            }
        }

        // 4. Estimate EPS CAGR
        if (data.quarters?.data && data.quarters.data['EPS']) {
            const epsValues = Object.values(data.quarters.data['EPS']).map(v => parseFloat(v)).filter(v => !isNaN(v) && v > 0);
            if (epsValues.length >= 5) {
                const latestEps = epsValues[0];
                const olderEps = epsValues[4];
                if (olderEps > 0) epsCagr = ((latestEps - olderEps) / olderEps) * 100;
            }
        }

        console.log(`Screener: Success for ${symbol}. Values: ROE=${roe.toFixed(1)}%`);
        return {
            roe: roe.toFixed(1),
            roce: roce.toFixed(1),
            currentRatio: currentRatio.toFixed(2),
            operatingMargin: operatingMargin.toFixed(1),
            epsCagr: epsCagr.toFixed(1),
        };
    } catch (error) {
        console.error(`Screener: Error fetching data for ${symbol}:`, error.message);
        return null;
    }
}

module.exports = { getFundamentalsFromScreener };