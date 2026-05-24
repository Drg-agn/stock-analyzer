async function fetchFundamentals(symbol) {
  try {
    const ticker = `${symbol}.BSE`; // BSE works more reliably than NSE on AV free tier

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

    // ── DEBUG: log raw response to see what AV actually returns ──
    console.log(`[${symbol}] Overview keys:`, Object.keys(overview));
    console.log(`[${symbol}] ReturnOnEquityTTM:`, overview.ReturnOnEquityTTM);
    console.log(`[${symbol}] Income reports count:`, income.annualReports?.length);
    console.log(`[${symbol}] Balance reports count:`, balance.annualReports?.length);

    // ── ROE ──────────────────────────────────────────────────────
    // AV returns "None" as a string when data is unavailable — guard against it
    const roeRaw = overview.ReturnOnEquityTTM;
    const roe = roeRaw && roeRaw !== "None" && roeRaw !== "-"
      ? Number(roeRaw) * 100
      : calcROEFromStatements(income, balance); // fallback: calculate manually

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
    // AV does NOT have an "ebit" field — use "operatingIncome" instead
    let roce = 0;
    if (balance.annualReports?.length > 0 && income.annualReports?.length > 0) {
      const latestBalance = balance.annualReports[0];
      const latestIncome  = income.annualReports[0];

      const totalAssets        = Number(latestBalance.totalAssets           || 0);
      const currentLiabilities = Number(latestBalance.totalCurrentLiabilities || 0);
      const capitalEmployed    = totalAssets - currentLiabilities;

      // operatingIncome is the correct AV field name (ebit doesn't exist in AV)
      const operatingIncome = Number(latestIncome.operatingIncome || 0);

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

// ── Manual ROE fallback if overview doesn't have it ──────────
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