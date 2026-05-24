// scoring.service.js
// SOVEX CAPITAL — Full PDF Scoring Formula
// Final = 0.35×Trend + 0.30×Technical + 0.20×Momentum + 0.15×Quality

const n = (v, fallback = 0) =>
  v === undefined || v === null || v === "" ? fallback : Number(v);

const calculateScore = (stock, fund = {}, mom = {}, tech = {}) => {

  const { cmp, high52, low52, sma50, sma200 } = stock;
  const sma150 = sma200; // Yahoo doesn't give 150DMA; use 200 as proxy

  const pctBelowHigh = high52 > 0 ? ((high52 - cmp) / high52) * 100 : 100;
  const pctAboveLow  = low52  > 0 ? ((cmp - low52)  / low52)  * 100 : 0;

  // ── PART 1: TREND (raw max 90, normalize to 100) ──────────

  let trendRaw = 0;

  // 1. CMP above 150 & 200 DMA (max 15)
  const aboveBoth = cmp > sma150 && cmp > sma200;
  const aboveOne  = cmp > sma150 || cmp > sma200;
  if      (aboveBoth) trendRaw += 15;
  else if (aboveOne)  trendRaw += 7;

  // 2. 50 > 150 > 200 DMA (max 20)
  if      (sma50 > sma150 && sma150 > sma200) trendRaw += 20;
  else if (sma50 > sma150)                     trendRaw += 10;

  // 3. 200 DMA trending up proxy (max 15)
  if (sma200 > 0 && sma50 > sma200) trendRaw += 15;

  // 4. CMP > 50 DMA (max 10)
  if (cmp > sma50) trendRaw += 10;

  // 5. CMP ≥ 30% above 52W Low (max 10)
  if      (pctAboveLow >= 50) trendRaw += 10;
  else if (pctAboveLow >= 30) trendRaw += 7;
  else if (pctAboveLow >= 20) trendRaw += 4;

  // 6. CMP within 25% of 52W High (max 20)
  if      (pctBelowHigh <= 10) trendRaw += 20;
  else if (pctBelowHigh <= 15) trendRaw += 18;
  else if (pctBelowHigh <= 20) trendRaw += 15;
  else if (pctBelowHigh <= 25) trendRaw += 10;

  // 7. Relative Strength proxy (max 10)
  const rs = aboveBoth && cmp > sma50 ? 75 : 50;
  if      (rs >= 90) trendRaw += 10;
  else if (rs >= 80) trendRaw += 8;
  else if (rs >= 70) trendRaw += 5;

  const trendScore = Math.min(Math.round((trendRaw / 90) * 100), 100);

  // ── PART 2: QUALITY (max 100) ─────────────────────────────

  let qualityScore = 0;

  const ps = n(fund.piotroski);
  if      (ps >= 8)   qualityScore += 5;
  else if (ps >= 6)   qualityScore += 4;
  else if (ps >= 4.5) qualityScore += 3;

  const roe = n(fund.roe);
  if      (roe >= 25) qualityScore += 20;
  else if (roe >= 20) qualityScore += 16;
  else if (roe >= 15) qualityScore += 12;
  else if (roe >= 10) qualityScore += 6;

  const roce = n(fund.roce);
  if      (roce >= 25) qualityScore += 30;
  else if (roce >= 20) qualityScore += 25;
  else if (roce >= 15) qualityScore += 20;
  else if (roce >= 10) qualityScore += 10;

  const epsCagr = n(fund.epsCagr);
  if      (epsCagr >= 25) qualityScore += 25;
  else if (epsCagr >= 20) qualityScore += 20;
  else if (epsCagr >= 15) qualityScore += 15;
  else if (epsCagr >= 10) qualityScore += 8;

  const cr = n(fund.currentRatio);
  if      (cr >= 1.5) qualityScore += 10;
  else if (cr >= 1.3) qualityScore += 8;
  else if (cr >= 1.1) qualityScore += 6;
  else if (cr >= 0.9) qualityScore += 4;

  const om = n(fund.operatingMargin);
  if      (om >= 25) qualityScore += 10;
  else if (om >= 20) qualityScore += 8;
  else if (om >= 15) qualityScore += 6;
  else if (om >= 10) qualityScore += 4;

  // ── PART 3: MOMENTUM (max 100) ────────────────────────────

  let momentumScore = 0;

  const barSize = n(mom.entryBarSize);
  if      (barSize >= 8) momentumScore += 10;
  else if (barSize >= 7) momentumScore += 8;
  else if (barSize >= 5) momentumScore += 6;
  else if (barSize >= 3) momentumScore += 4;
  else if (barSize >  0) momentumScore += 2;

  const volRatio = n(mom.volumeRatio);
  if      (volRatio >= 1.5) momentumScore += 10;
  else if (volRatio >= 1.3) momentumScore += 8;
  else if (volRatio >= 1.1) momentumScore += 6;
  else if (volRatio >= 0.9) momentumScore += 4;

  const secScore = n(mom.sectorScore);
  if      (secScore >= 65) momentumScore += 10;
  else if (secScore >= 55) momentumScore += 8;
  else if (secScore >= 50) momentumScore += 6;
  else if (secScore >= 45) momentumScore += 4;

  if (mom.entryBarClosingWithin25) momentumScore += 10;

  const candleHigh = n(mom.candleHighWeeks);
  if      (candleHigh >= 10) momentumScore += 10;
  else if (candleHigh === 9) momentumScore += 8;
  else if (candleHigh === 8) momentumScore += 6;
  else if (candleHigh === 7) momentumScore += 4;
  else if (candleHigh >   6) momentumScore += 2;

  if (mom.macdPositive)  momentumScore += 10;
  if (mom.sgvMacd)       momentumScore += 10;
  if (mom.above20MA)     momentumScore += 10;
  if (pctBelowHigh <= 25) momentumScore += 10;  // auto from price data
  if (mom.niftyAboveEMA) momentumScore += 10;

  // ── PART 4: TECHNICAL (max 100) ───────────────────────────

  let technicalScore = 0;

  const conRange = n(tech.consolidationRange, 99);
  if      (conRange < 5)  technicalScore += 10;
  else if (conRange < 10) technicalScore += 8;
  else if (conRange < 15) technicalScore += 6;
  else if (conRange < 20) technicalScore += 4;

  const bars = n(tech.barsInConsolidation);
  if      (bars >= 10) technicalScore += 10;
  else if (bars >= 5)  technicalScore += bars; // 5→5, 6→6 … 9→9

  const adr = n(tech.adrPercent, 99);
  if      (adr < 5)  technicalScore += 10;
  else if (adr < 10) technicalScore += 8;
  else if (adr < 15) technicalScore += 6;
  else if (adr < 20) technicalScore += 4;

  const sl = n(tech.stoplossPercent, 99);
  if      (sl < 5)  technicalScore += 10;
  else if (sl < 10) technicalScore += 8;
  else if (sl < 15) technicalScore += 6;
  else if (sl < 20) technicalScore += 4;

  const tight = n(tech.tightnessScore);
  if      (tight >= 8)   technicalScore += 5;
  else if (tight >= 6)   technicalScore += 4;
  else if (tight >= 4.5) technicalScore += 3;

  if (tech.higherLowFormation)    technicalScore += 10;
  if (tech.vcpPattern)            technicalScore += 10;
  if (!tech.weeklyCloseBelowEMA)  technicalScore += 10; // ★ INVERTED
  if (tech.volumeDecreasing)      technicalScore += 10;
  if (pctBelowHigh <= 20)         technicalScore += 10; // auto from price

  // ── FINAL ─────────────────────────────────────────────────

  const finalScore = Math.round(
    0.35 * trendScore +
    0.30 * technicalScore +
    0.20 * momentumScore +
    0.15 * qualityScore
  );

  let signal = "AVOID";
  if      (finalScore > 70) signal = "BUY";
  else if (finalScore > 60) signal = "WATCH";

  return {
    trendScore,
    qualityScore,
    momentumScore,
    technicalScore,
    finalScore,
    signal,
    pctBelowHigh: pctBelowHigh.toFixed(1),
    pctAboveLow:  pctAboveLow.toFixed(1),
  };
};

module.exports = { calculateScore };