const axios = require("axios");

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// ── Manual ROE fallback ───────────────────────────────────────
function calcROEFromStatements(income, balance) {
  try {
    const netIncome   = Number(income.annualReports?.[0]?.netIncome || 0);
    const totalEquity = Number(balance.annualReports?.[0]?.totalShareholderEquity || 0);
    if (totalEquity > 0 && netIncome !== 0) {
      return (netIncome / totalEquity) * 100;
    }
  } catch (_) {}
  return 0;
}

// ── Quality Score Calculator (Sovex PDF formula, max 100) ─────
function calcQualityScore({ piotroski, roe, roce, epsCagr, currentRatio, operatingMargin }) {
  let score = 0;

  // Piotroski (max 5)
  const p = Number(piotroski || 0);
  if      (p >= 8)   score += 5;
  else if (p >= 6)   score += 4;
  else if (p >= 4.5) score += 3;
  // ≤4 → 0

  // ROE % (max 20)
  const r = Number(roe || 0);
  if      (r >= 25) score += 20;
  else if (r >= 20) score += 16;
  else if (r >= 15) score += 12;
  else if (r >= 10) score += 6;

  // ROCE % (max 30)
  const rc = Number(roce || 0);
  if      (rc >= 25) score += 30;
  else if (rc >= 20) score += 25;
  else if (rc >= 15) score += 20;
  else if (rc >= 10) score += 10;

  // EPS CAGR % (max 25)
  const eps = Number(epsCagr || 0);
  if      (eps >= 25) score += 25;
  else if (eps >= 20) score += 20;
  else if (eps >= 15) score += 15;
  else if (eps >= 10) score += 8;

  // Current Ratio (max 10)
  const cr = Number(currentRatio || 0);
  if      (cr >= 1.5) score += 10;
  else if (cr >= 1.3) score += 8;
  else if (cr >= 1.1) score += 6;
  else if (cr >= 0.9) score += 4;

  // Operating Margin % (max 10)
  const om = Number(operatingMargin || 0);
  if      (om >= 25) score += 10;
  else if (om >= 20) score += 8;
  else if (om >= 15) score += 6;
  else if (om >= 10) score += 4;

  return score; // 0–100
}

// ── Fetch Fundamentals from Alpha Vantage ─────────────────────
async function fetchFundamentals(symbol) {
  try {
    const ticker = `${symbol}.BSE`;

    const overviewURL = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${API_KEY}`;
    const incomeURL   = `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${ticker}&apikey=${API_KEY}`;
    const balanceURL  = `https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol=${ticker}&apikey=${API_KEY}`;

    const [overviewRes, incomeRes, balanceRes] = await Promise.all([
      axios.get(overviewURL),
      axios.get(incomeURL),
      axios.get(balanceURL),
    ]);

    const overview = overviewRes.data;
    const income   = incomeRes.data;
    const balance  = balanceRes.data;

    console.log(`[${symbol}] Overview keys:`, Object.keys(overview));
    console.log(`[${symbol}] ReturnOnEquityTTM:`, overview.ReturnOnEquityTTM);
    console.log(`[${symbol}] Income reports count:`, income.annualReports?.length);
    console.log(`[${symbol}] Balance reports count:`, balance.annualReports?.length);

    // ── ROE ──────────────────────────────────────────────────────
    const roeRaw = overview.ReturnOnEquityTTM;
    const roe = roeRaw && roeRaw !== "None" && roeRaw !== "-"
      ? Number(roeRaw) * 100
      : calcROEFromStatements(income, balance);

    // ── OPERATING MARGIN ─────────────────────────────────────────
    const omRaw = overview.OperatingMarginTTM;
    const operatingMargin = omRaw && omRaw !== "None" && omRaw !== "-"
      ? Number(omRaw) * 100
      : 0;

    // ── EPS CAGR ─────────────────────────────────────────────────
    let epsCagr = 0;
    if (income.annualReports && income.annualReports.length >= 2) {
      const latestEPS   = Number(income.annualReports[0].reportedEPS || 0);
      const previousEPS = Number(income.annualReports[1].reportedEPS || 0);
      if (previousEPS > 0 && !isNaN(latestEPS) && !isNaN(previousEPS)) {
        epsCagr = ((latestEPS - previousEPS) / previousEPS) * 100;
      }
    }

    // ── ROCE ─────────────────────────────────────────────────────
    let roce = 0;
    if (balance.annualReports?.length > 0 && income.annualReports?.length > 0) {
      const latestBalance = balance.annualReports[0];
      const latestIncome  = income.annualReports[0];

      const totalAssets        = Number(latestBalance.totalAssets || 0);
      const currentLiabilities = Number(latestBalance.totalCurrentLiabilities || 0);
      const capitalEmployed    = totalAssets - currentLiabilities;
      const operatingIncome    = Number(latestIncome.operatingIncome || 0);

      console.log(`[${symbol}] operatingIncome:`, operatingIncome, `capitalEmployed:`, capitalEmployed);

      if (capitalEmployed > 0 && operatingIncome !== 0) {
        roce = (operatingIncome / capitalEmployed) * 100;
      }
    }

    // ── CURRENT RATIO ─────────────────────────────────────────────
    let currentRatio = 0;
    if (balance.annualReports?.length > 0) {
      const latestBalance      = balance.annualReports[0];
      const currentAssets      = Number(latestBalance.totalCurrentAssets      || 0);
      const currentLiabilities = Number(latestBalance.totalCurrentLiabilities || 0);
      if (currentLiabilities > 0) {
        currentRatio = currentAssets / currentLiabilities;
      }
    }

    return {
      roe:             isNaN(roe)             ? 0 : Number(roe.toFixed(1)),
      roce:            isNaN(roce)            ? 0 : Number(roce.toFixed(1)),
      operatingMargin: isNaN(operatingMargin) ? 0 : Number(operatingMargin.toFixed(1)),
      epsCagr:         isNaN(epsCagr)         ? 0 : Number(epsCagr.toFixed(1)),
      currentRatio:    isNaN(currentRatio)    ? 0 : Number(currentRatio.toFixed(2)),
    };
  } catch (err) {
    console.log("Alpha Vantage Error:", err.message);
    return { roe: 0, roce: 0, operatingMargin: 0, epsCagr: 0, currentRatio: 0 };
  }
}

// ── Analyze Controller ────────────────────────────────────────
const analyzeStocks = async (req, res) => {
  try {
    const { tickers, manual } = req.body; // manual is keyed by ticker symbol

    const results = [];

    for (const ticker of tickers) {
      try {
        const fundamentals = await fetchFundamentals(ticker);
        const manualData   = manual?.[ticker] || {};

        // ── Quality Score (real formula from PDF) ──────────────
        const qualityScore = calcQualityScore({
          piotroski:       manualData.piotroski     || 0,
          roe:             fundamentals.roe,
          roce:            fundamentals.roce,
          epsCagr:         fundamentals.epsCagr,
          currentRatio:    fundamentals.currentRatio,
          operatingMargin: fundamentals.operatingMargin,
        });

        // ── Other scores still random (replace later) ──────────
        const trendScore     = Math.floor(Math.random() * 30 + 70);
        const technicalScore = Math.floor(Math.random() * 30 + 65);
        const momentumScore  = Math.floor(Math.random() * 30 + 60);

        // ── Final Score (weighted per PDF) ─────────────────────
        // 35% Trend + 30% Technical + 20% Momentum + 15% Quality
        const finalScore = Math.round(
          0.35 * trendScore +
          0.30 * technicalScore +
          0.20 * momentumScore +
          0.15 * qualityScore
        );

        let signal = "AVOID";
        if (finalScore > 70)      signal = "BUY";
        else if (finalScore > 60) signal = "WATCH";

        results.push({
          ticker,
          name: ticker,

          trendScore,
          technicalScore,
          momentumScore,
          qualityScore,

          finalScore,
          signal,

          cmp:     Math.floor(Math.random() * 2000 + 100),
          high52:  Math.floor(Math.random() * 2500 + 500),
          low52:   Math.floor(Math.random() * 500 + 50),
          sma50:   Math.floor(Math.random() * 1500 + 100),
          sma200:  Math.floor(Math.random() * 1200 + 100),

          pctBelowHigh: Math.floor(Math.random() * 20),
          pctAboveLow:  Math.floor(Math.random() * 100),

          autoData: {
            roe:             fundamentals.roe,
            roce:            fundamentals.roce,
            currentRatio:    fundamentals.currentRatio,  // real data, not hardcoded
            operatingMargin: fundamentals.operatingMargin,
            epsCagr:         fundamentals.epsCagr,
            macdPositive:    true,
            above20MA:       true,
            volumeRatio:     1.5,
            niftyAboveEMA:   true,
          },
        });
      } catch (err) {
        console.log(`Error analyzing ${ticker}:`, err.message);
      }
    }

    res.json({ results });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: "Server Error" });
  }
};

module.exports = { analyzeStocks };