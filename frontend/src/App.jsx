import { useState } from "react";
import API from "./api/stockApi";
import "./arka.css";

// ── default manual data shape ─────────────────────────────────
const initManual = () => ({
  piotroski: "",
  sectorScore: "",
  entryBarClosingWithin25: false,
  candleHighWeeks: "",
  sgvMacd: false,
  consolidationRange: "",
  barsInConsolidation: "",
  adrPercent: "",
  stoplossPercent: "",
  tightnessScore: "",
  higherLowFormation: false,
  vcpPattern: false,
  weeklyCloseBelowEMA: false,
  volumeDecreasing: false,
});

// ── helpers ───────────────────────────────────────────────────
const num = (v) => (v === "" || v == null ? undefined : Number(v));
const bool = (v) => Boolean(v);

function signalColor(signal) {
  if (signal === "BUY") return "#4ade80";
  if (signal === "WATCH") return "#facc15";
  return "#f87171";
}
function scoreColor(s) {
  if (s >= 70) return "#4ade80";
  if (s >= 50) return "#facc15";
  return "#f87171";
}
function fmt(v, dec = 1) {
  if (v == null || v === "") return "—";
  const num = Number(v);
  if (isNaN(num)) return "—";
  return num.toFixed(dec);
}

// ── Field / Toggle sub-components ────────────────────────────
function Field({ label, value, onChange, hint }) {
  return (
    <div className="fieldItem">
      <label className="fieldLabel">{label}{hint && <span className="fieldHint"> {hint}</span>}</label>
      <input
        className="fieldInput"
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
      />
    </div>
  );
}

function Toggle({ label, val, onChange }) {
  return (
    <div className="fieldItem toggleItem">
      <label className="fieldLabel">{label}</label>
      <button
        className={`toggleSwitch ${val ? "on" : "off"}`}
        onClick={() => onChange(!val)}
      >
        {val ? "YES" : "NO"}
      </button>
    </div>
  );
}

// ── ManualPanel ───────────────────────────────────────────────
function ManualPanel({ index, data, onChange }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("quality");

  const set = (k, v) => onChange(index, { ...data, [k]: v });

  return (
    <div className="manualWrap">
      <button className="toggleBtn" onClick={() => setOpen(!open)}>
        {open ? "▲ Hide Manual Fields" : "▼ Add Manual Fields"}
        <span className="toggleNote"> (auto fields are fetched)</span>
      </button>

      {open && (
        <div className="manualPanel">
          <div className="tabs">
            {[
              { id: "quality", label: "📊 Quality" },
              { id: "momentum", label: "⚡ Momentum" },
              { id: "technical", label: "🔧 Technical" },
            ].map((t) => (
              <button
                key={t.id}
                className={`tab ${tab === t.id ? "tabActive" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "quality" && (
            <div className="panelContent">
              <div className="autoNote">✅ Auto-fetched: ROE, ROCE, Current Ratio, Operating Margin, EPS CAGR</div>
              <div className="fieldGrid">
                <Field label="Piotroski Score" hint="(0–9)" value={data.piotroski} onChange={(v) => set("piotroski", v)} />
              </div>
            </div>
          )}

          {tab === "momentum" && (
            <div className="panelContent">
              <div className="autoNote">✅ Auto-fetched: MACD, Above 20MA, Volume Ratio, Bar Size, Nifty EMA</div>
              <div className="fieldGrid">
                <Field label="Sector Score" hint="(0–100)" value={data.sectorScore} onChange={(v) => set("sectorScore", v)} />
                <Field label="Candle High (weeks back)" value={data.candleHighWeeks} onChange={(v) => set("candleHighWeeks", v)} />
                <Toggle label="Entry Bar Closing Within 25% of High" val={data.entryBarClosingWithin25} onChange={(v) => set("entryBarClosingWithin25", v)} />
                <Toggle label="SGV MACD Theory Applied" val={data.sgvMacd} onChange={(v) => set("sgvMacd", v)} />
              </div>
            </div>
          )}

          {tab === "technical" && (
            <div className="panelContent">
              <div className="autoNote">✅ Auto-calculated: Base within 20% of 52W High</div>
              <div className="fieldGrid">
                <Field label="6-Bar Consolidation Range %" value={data.consolidationRange} onChange={(v) => set("consolidationRange", v)} />
                <Field label="Bars in Consolidation" value={data.barsInConsolidation} onChange={(v) => set("barsInConsolidation", v)} />
                <Field label="ADR % Volatility" value={data.adrPercent} onChange={(v) => set("adrPercent", v)} />
                <Field label="Stoploss % Risk" value={data.stoplossPercent} onChange={(v) => set("stoplossPercent", v)} />
                <Field label="Tightness Score" hint="((HH-LL)/LL×100)" value={data.tightnessScore} onChange={(v) => set("tightnessScore", v)} />
                <Toggle label="Higher Low Formation in Base" val={data.higherLowFormation} onChange={(v) => set("higherLowFormation", v)} />
                <Toggle label="VCP Pattern (Last 3 Swings)" val={data.vcpPattern} onChange={(v) => set("vcpPattern", v)} />
                <Toggle label="Weekly Close Below 20 EMA? (inverted)" val={data.weeklyCloseBelowEMA} onChange={(v) => set("weeklyCloseBelowEMA", v)} />
                <Toggle label="Volume Decreasing over Weeks" val={data.volumeDecreasing} onChange={(v) => set("volumeDecreasing", v)} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AutoDataRow — shows what was auto-fetched ─────────────────
function AutoDataRow({ autoData }) {
  if (!autoData) return <div className="autoDataRow">No data</div>;
  return (
    <div className="autoDataRow">
      <span className="autoTag">AUTO</span>
      <span>ROE {fmt(autoData.roe)}%</span>
      <span>ROCE {fmt(autoData.roce)}%</span>
      <span>CR {fmt(autoData.currentRatio, 2)}</span>
      <span>OPM {fmt(autoData.operatingMargin)}%</span>
      <span>EPS CAGR {fmt(autoData.epsCagr)}%</span>
      <span className={autoData.macdPositive ? "chip green" : "chip red"}>
        MACD {autoData.macdPositive ? "+" : "−"}
      </span>
      <span className={autoData.above20MA ? "chip green" : "chip red"}>
        {autoData.above20MA ? "↑20MA" : "↓20MA"}
      </span>
      <span>VolR {fmt(autoData.volumeRatio, 2)}x</span>
      <span className={autoData.niftyAboveEMA ? "chip green" : "chip red"}>
        Nifty {autoData.niftyAboveEMA ? "▲EMA" : "▼EMA"}
      </span>
    </div>
  );
}

// ── ScoreCard ─────────────────────────────────────────────────
function ScoreCard({ stock }) {
  const scores = [
    { label: "Trend", val: stock.trendScore, weight: "35%" },
    { label: "Technical", val: stock.technicalScore, weight: "30%" },
    { label: "Momentum", val: stock.momentumScore, weight: "20%" },
    { label: "Quality", val: stock.qualityScore, weight: "15%" },
  ];

  return (
    <div className="stockCard">
      <div className="cardHeader">
        <div>
          <h2 className="cardTicker">{stock.ticker}</h2>
          <p className="cardName">{stock.name}</p>
        </div>
        <div className="signalBadge" style={{ background: signalColor(stock.signal) }}>
          {stock.signal}
        </div>
      </div>

      <div className="finalScoreBox">
        <span className="finalScoreNum" style={{ color: scoreColor(stock.finalScore) }}>
          {stock.finalScore}
        </span>
        <span className="finalScoreLabel">/100</span>
      </div>

      <div className="subScores">
        {scores.map((s) => (
          <div key={s.label} className="subScoreRow">
            <div className="subScoreMeta">
              <span>{s.label}</span>
              <span className="subScoreWeight">{s.weight}</span>
            </div>
            <div className="barTrack">
              <div className="barFill" style={{ width: `${s.val}%`, background: scoreColor(s.val) }} />
            </div>
            <span className="subScoreVal">{s.val}</span>
          </div>
        ))}
      </div>

      <AutoDataRow autoData={stock.autoData} />

      <div className="priceGrid">
        <div className="priceBox">
          <p className="priceLabel">CMP</p>
          <p className="priceVal">₹{stock.cmp}</p>
        </div>
        <div className="priceBox">
          <p className="priceLabel">52W High</p>
          <p className="priceVal">₹{stock.high52}</p>
        </div>
        <div className="priceBox">
          <p className="priceLabel">52W Low</p>
          <p className="priceVal">₹{stock.low52}</p>
        </div>
      </div>

      <div className="maRow">
        <span>SMA 50: <b>₹{Math.round(stock.sma50)}</b></span>
        <span>SMA 200: <b>₹{Math.round(stock.sma200)}</b></span>
      </div>
      <div className="maRow" style={{ marginTop: 4 }}>
        <span>% below 52W High: <b>{stock.pctBelowHigh}%</b></span>
        <span>% above 52W Low: <b>{stock.pctAboveLow}%</b></span>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  const [stocks, setStocks] = useState(["", "", "", "", ""]);
  const [manual, setManual] = useState(Array(5).fill(null).map(initManual));
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleTicker = (i, v) => {
    const u = [...stocks];
    u[i] = v.toUpperCase();
    setStocks(u);
  };

  const handleManual = (i, data) => {
    const u = [...manual];
    u[i] = data;
    setManual(u);
  };

  const handleAnalyze = async () => {
    try {
      setLoading(true);
      setResults([]);

      const tickers = stocks.filter((s) => s.trim() !== "");
      if (!tickers.length) {
        alert("Enter at least one ticker");
        return;
      }

      const manualMap = {};
      stocks.forEach((ticker, i) => {
        if (!ticker.trim()) return;
        const m = manual[i];
        manualMap[ticker] = {
          piotroski: num(m.piotroski),
          sectorScore: num(m.sectorScore),
          entryBarClosingWithin25: bool(m.entryBarClosingWithin25),
          candleHighWeeks: num(m.candleHighWeeks),
          sgvMacd: bool(m.sgvMacd),
          consolidationRange: num(m.consolidationRange),
          barsInConsolidation: num(m.barsInConsolidation),
          adrPercent: num(m.adrPercent),
          stoplossPercent: num(m.stoplossPercent),
          tightnessScore: num(m.tightnessScore),
          higherLowFormation: bool(m.higherLowFormation),
          vcpPattern: bool(m.vcpPattern),
          weeklyCloseBelowEMA: bool(m.weeklyCloseBelowEMA),
          volumeDecreasing: bool(m.volumeDecreasing),
        };
      });

      // ✅ Single API call
      const res = await API.post("/analyze", { tickers, manual: manualMap });
      console.log("API Response:", res.data);
      setResults(res.data.results);
    } catch (err) {
      console.error(err);
      alert("Error fetching stocks. Check ticker symbols and ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="headerBlock">
        <p className="headerSub">SOVEX CAPITAL</p>
        <h1 className="title">Swing Stock Analyzer</h1>
        <p className="headerDesc">35% Trend · 30% Technical · 20% Momentum · 15% Quality</p>
      </div>

      <div className="inputSection">
        {stocks.map((stock, i) => (
          <div key={i} className="stockInputBlock">
            <div className="inputRow">
              <span className="inputNum">{i + 1}</span>
              <input
                type="text"
                placeholder={`Ticker ${i + 1} e.g. RELIANCE`}
                value={stock}
                onChange={(e) => handleTicker(i, e.target.value)}
                className="stockInput"
              />
            </div>
            {stock.trim() && <ManualPanel index={i} data={manual[i]} onChange={handleManual} />}
          </div>
        ))}
      </div>

      <button className="analyzeBtn" onClick={handleAnalyze} disabled={loading}>
        {loading ? "Fetching & Analyzing…" : "🔍 Analyze Stocks"}
      </button>

      {results.length > 0 && (
        <>
          <div className="resultsHeader">
            <h2>Results</h2>
            {results[0] && (
              <p className="bestPick">
                🏆 Best Pick: <strong>{results[0].ticker}</strong> — {results[0].finalScore}/100 ({results[0].signal})
              </p>
            )}
          </div>
          <div className="resultsGrid">
            {results.map((s, i) => (
              <ScoreCard key={i} stock={s} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}