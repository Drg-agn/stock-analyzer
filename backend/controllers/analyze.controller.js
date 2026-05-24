const { getStockQuote, getNiftyAboveEMA } = require("../services/stock.service");
const { calculateScore } = require("../services/scoring.service");

exports.analyzeStocks = async (req, res) => {
  try {
    let { tickers, manual } = req.body;
    if (!tickers || !tickers.length) {
      return res.status(400).json({ error: "No tickers provided" });
    }

    // Get Nifty condition once
    const niftyAboveEMA = await getNiftyAboveEMA();

    const results = [];

    for (const symbol of tickers) {
      try {
        // 1. Fetch all auto data (prices, fundamentals, momentum)
        const stockData = await getStockQuote(symbol);
        if (!stockData) {
          results.push({ ticker: symbol, error: "Failed to fetch data" });
          continue;
        }

        // 2. Extract price fields needed for scoring
        const priceInfo = {
          cmp: stockData.regularMarketPrice,
          high52: stockData.fiftyTwoWeekHigh,
          low52: stockData.fiftyTwoWeekLow,
          sma50: stockData.fiftyDayAverage,
          sma200: stockData.twoHundredDayAverage,
        };

        // 3. Manual inputs for this ticker (if any)
        const manualData = (manual && manual[symbol]) || {};

        // 4. Build `fund` object for quality scoring
        const fund = {
          piotroski: Number(manualData.piotroski) || 0,
          roe: parseFloat(stockData.roe),
          roce: parseFloat(stockData.roce),
          currentRatio: parseFloat(stockData.currentRatio),
          operatingMargin: parseFloat(stockData.operatingMargin),
          epsCagr: parseFloat(stockData.epsCagr),
        };

        // 5. Build `mom` object for momentum scoring
        const mom = {
          entryBarSize: stockData.entryBarSize,
          volumeRatio: stockData.volumeRatio,
          sectorScore: Number(manualData.sectorScore) || 0,
          entryBarClosingWithin25: manualData.entryBarClosingWithin25 === true,
          candleHighWeeks: Number(manualData.candleHighWeeks) || 0,
          macdPositive: stockData.macdPositive,
          sgvMacd: manualData.sgvMacd === true,
          above20MA: stockData.above20MA,
          niftyAboveEMA: niftyAboveEMA,
        };

        // 6. Build `tech` object for technical scoring
        const tech = {
          consolidationRange: Number(manualData.consolidationRange) || 0,
          barsInConsolidation: Number(manualData.barsInConsolidation) || 0,
          adrPercent: Number(manualData.adrPercent) || 0,
          stoplossPercent: Number(manualData.stoplossPercent) || 0,
          tightnessScore: Number(manualData.tightnessScore) || 0,
          higherLowFormation: manualData.higherLowFormation === true,
          vcpPattern: manualData.vcpPattern === true,
          weeklyCloseBelowEMA: manualData.weeklyCloseBelowEMA === true,
          volumeDecreasing: manualData.volumeDecreasing === true,
        };

        // 7. Calculate scores using PDF formula
        const scores = calculateScore(priceInfo, fund, mom, tech);

        // 8. Prepare autoData for frontend display
        const autoData = {
          roe: fund.roe.toFixed(1),
          roce: fund.roce.toFixed(1),
          currentRatio: fund.currentRatio.toFixed(2),
          operatingMargin: fund.operatingMargin.toFixed(1),
          epsCagr: fund.epsCagr.toFixed(1),
          macdPositive: stockData.macdPositive,
          above20MA: stockData.above20MA,
          volumeRatio: stockData.volumeRatio,
          entryBarSize: stockData.entryBarSize,
          niftyAboveEMA: niftyAboveEMA,
        };

        // 9. Push final result
        results.push({
          ticker: symbol,
          name: stockData.shortName || symbol,
          cmp: Math.round(stockData.regularMarketPrice),
          high52: Math.round(stockData.fiftyTwoWeekHigh),
          low52: Math.round(stockData.fiftyTwoWeekLow),
          sma50: Math.round(stockData.fiftyDayAverage),
          sma200: Math.round(stockData.twoHundredDayAverage),
          pctBelowHigh: scores.pctBelowHigh,
          pctAboveLow: scores.pctAboveLow,
          trendScore: scores.trendScore,
          technicalScore: scores.technicalScore,
          momentumScore: scores.momentumScore,
          qualityScore: scores.qualityScore,
          finalScore: scores.finalScore,
          signal: scores.signal,
          autoData: autoData,
        });
      } catch (err) {
        console.error(`Error processing ${symbol}:`, err.message);
        results.push({ ticker: symbol, error: err.message });
      }
    }

    // Sort by finalScore descending
    results.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
    res.json({ results });
  } catch (error) {
    console.error("Analyze controller error:", error);
    res.status(500).json({ error: error.message });
  }
};