export const scoreColor = (score) => {
  if (score >= 70) return "#22c55e";
  if (score >= 55) return "#f59e0b";
  return "#ef4444";
};

export const signalType = (score) => {
  if (score >= 70) return "BUY";
  if (score >= 55) return "WATCH";
  return "AVOID";
};