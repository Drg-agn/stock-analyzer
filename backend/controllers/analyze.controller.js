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

// ── Fetch Fundamentals ────────────────────────────────────────
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

    return {
      roe:             isNaN(roe)             ? 0 : roe.toFixed(1),
      roce:            isNaN(roce)            ? 0 : roce.toFixed(1),
      operatingMargin: isNaN(operatingMargin) ? 0 : operatingMargin.toFixed(1),
      epsCagr:         isNaN(epsCagr)         ? 0 : epsCagr.toFixed(1),
    };
  } catch (err) {
    console.log("Alpha Vantage Error:", err.message);
    return { roe: 0, roce: 0, operatingMargin: 0, epsCagr: 0 };
  }
}

// ── Analyze Controller ────────────────────────────────────────
const analyzeStocks = async (req, res) => {
  try {
    const { tickers } = req.body;

    const results = [];

    for (const ticker of tickers) {
      try {
        const fundamentals = await fetchFundamentals(ticker);

        const finalScore = Math.floor(Math.random() * 40 + 60);
        let signal = "AVOID";
        if (finalScore >= 80) signal = "BUY";
        else if (finalScore >= 65) signal = "WATCH";

        results.push({
          ticker,
          name: ticker,

          trendScore:     Math.floor(Math.random() * 30 + 70),
          technicalScore: Math.floor(Math.random() * 30 + 65),
          momentumScore:  Math.floor(Math.random() * 30 + 60),
          qualityScore:   Math.floor(Math.random() * 30 + 60),

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
            currentRatio:    1.8,
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