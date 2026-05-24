// =============================================================
//  analyze.controller.js
//  POST /api/analyze
//
//  Body:
//  {
//    tickers: ["RELIANCE", "AEROFLEX"],
//
//    // Only fields that CANNOT be auto-fetched need manual input:
//    manual: {
//      "RELIANCE": {
//        // Quality (manual only)
//        piotroski: 7,          // 0-9  — not on Yahoo
//        // epsCagr is auto-calculated; override here if you want
//
//        // Momentum (manual only)
//        sectorScore: 60,       // from Trendlyne
//        entryBarClosingWithin25: true,
//        candleHighWeeks: 8,
//        sgvMacd: true,
//
//        // Technical (all manual — chart pattern reading)
//        consolidationRange: 8,
//        barsInConsolidation: 7,
//        adrPercent: 4.5,
//        stoplossPercent: 7,
//        tightnessScore: 5,
//        higherLowFormation: true,
//        vcpPattern: false,
//        weeklyCloseBelowEMA: false,
//        volumeDecreasing: true,
//      }
//    }
//  }
// =============================================================

const { getStockQuote, getNiftyAboveEMA } = require("../services/stock.service");
const { calculateScore }                  = require("../services/scoring.service");

exports.analyzeStocks = async (req, res) => {
  try {
    const { tickers, manual = {} } = req.body;

    if (!tickers || tickers.length === 0) {
      return res.status(400).json({ error: "No tickers provided" });
    }

    // ── Fetch Nifty EMA once for all tickers ──────────────────
    const niftyAboveEMA = await getNiftyAboveEMA();

    const results = [];

    for (const ticker of tickers) {
      try {
        // ── 1. Fetch everything possible from Yahoo ────────────
        const quote = await getStockQuote(ticker);

        if (!quote) {
          console.warn(`Skipping ${ticker} — no data returned`);
          continue;
        }

        // ── 2. Build stock price object ────────────────────────
        const stock = {
          ticker,
          name:   quote.shortName,
          cmp:    Number(quote.regularMarketPrice   || 0),
          high52: Number(quote.fiftyTwoWeekHigh     || 0),
          low52:  Number(quote.fiftyTwoWeekLow      || 0),
          sma50:  Number(quote.fiftyDayAverage      || 0),
          sma200: Number(quote.twoHundredDayAverage || 0),
        };

        // ── 3. Build Quality object ────────────────────────────
        // Auto-fetched from Yahoo; manual override allowed
        const m = manual[ticker] || {};

        const fund = {
          piotroski:       m.piotroski        ?? null,  // manual only
          roe:             quote.roe           ?? null,  // auto
          roce:            quote.roce          ?? null,  // auto (EBIT/CapEmployed)
          epsCagr:         m.epsCagr           ?? quote.epsCagr ?? null, // auto, override allowed
          currentRatio:    quote.currentRatio  ?? null,  // auto
          operatingMargin: quote.operatingMargin ?? null, // auto
        };

        // ── 4. Build Momentum object ───────────────────────────
        // auto: macdPositive, above20MA, volumeRatio, entryBarSize, niftyAboveEMA
        // manual: sectorScore, entryBarClosingWithin25, candleHighWeeks, sgvMacd
        const mom = {
          entryBarSize:            quote.entryBarSize            ?? 0,     // auto
          volumeRatio:             quote.volumeRatio             ?? 0,     // auto
          sectorScore:             m.sectorScore                 ?? 0,     // manual
          entryBarClosingWithin25: m.entryBarClosingWithin25     ?? false, // manual
          candleHighWeeks:         m.candleHighWeeks             ?? 0,     // manual
          macdPositive:            quote.macdPositive            ?? false, // auto
          sgvMacd:                 m.sgvMacd                     ?? false, // manual
          above20MA:               quote.above20MA               ?? false, // auto
          niftyAboveEMA:           niftyAboveEMA,                          // auto (shared)
        };

        // ── 5. Build Technical object ──────────────────────────
        // All manual — chart pattern reading
        const tech = {
          consolidationRange:   m.consolidationRange   ?? 99,
          barsInConsolidation:  m.barsInConsolidation  ?? 0,
          adrPercent:           m.adrPercent           ?? 99,
          stoplossPercent:      m.stoplossPercent       ?? 99,
          tightnessScore:       m.tightnessScore        ?? 0,
          higherLowFormation:   m.higherLowFormation    ?? false,
          vcpPattern:           m.vcpPattern            ?? false,
          weeklyCloseBelowEMA:  m.weeklyCloseBelowEMA  ?? false,
          volumeDecreasing:     m.volumeDecreasing      ?? false,
          // base within 20% of 52W high is auto-calculated inside scoring.service
        };

        // ── 6. Score using full PDF formula ───────────────────
        const scores = calculateScore(stock, fund, mom, tech);

        // ── 7. Build result object ─────────────────────────────
        results.push({
          ticker,
          name: stock.name,

          // price
          cmp:    stock.cmp,
          high52: stock.high52,
          low52:  stock.low52,
          sma50:  stock.sma50,
          sma200: stock.sma200,

          // auto-fetched fundamentals (shown in UI for transparency)
          autoData: {
            roe:             fund.roe,
            roce:            fund.roce,
            currentRatio:    fund.currentRatio,
            operatingMargin: fund.operatingMargin,
            epsCagr:         fund.epsCagr,
            macdPositive:    mom.macdPositive,
            above20MA:       mom.above20MA,
            volumeRatio:     mom.volumeRatio,
            entryBarSize:    mom.entryBarSize,
            niftyAboveEMA,
          },

          // scores
          trendScore:     scores.trendScore,
          qualityScore:   scores.qualityScore,
          momentumScore:  scores.momentumScore,
          technicalScore: scores.technicalScore,
          finalScore:     scores.finalScore,
          signal:         scores.signal,

          pctBelowHigh: scores.pctBelowHigh,
          pctAboveLow:  scores.pctAboveLow,
        });

      } catch (err) {
        console.error(`Error processing ${ticker}:`, err.message);
      }
    }

    // Sort by finalScore descending
    results.sort((a, b) => b.finalScore - a.finalScore);

    return res.json({
      results,
      best: results[0] || null,
      niftyAboveEMA,
    });

  } catch (err) {
    console.error("analyzeStocks error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};