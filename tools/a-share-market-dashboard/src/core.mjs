export function clamp(value, min = 0, max = 100) { return Math.min(max, Math.max(min, value)); }

export function percentileRank(values, current) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length || !Number.isFinite(current)) return null;
  return clamp((valid.filter(value => value <= current).length / valid.length) * 100);
}

export function tradingDaysForWindow(years) {
  const map = { 1: 250, 3: 750, 5: 1250, 10: 2500 };
  if (!map[years]) throw new RangeError(`Unsupported window: ${years}`);
  return map[years];
}

export function deviationSeries(points, period = 250) {
  const output = [];
  let rolling = 0;
  points.forEach((point, index) => {
    rolling += point.close;
    if (index >= period) rolling -= points[index - period].close;
    if (index >= period - 1) {
      const average = rolling / period;
      output.push({ date: point.date, close: point.close, deviation: point.close / average - 1 });
    }
  });
  return output;
}

export function calculatePositionMetric(points, years, period = 250) {
  const series = deviationSeries(points, period);
  const sample = series.slice(-tradingDaysForWindow(years));
  if (!sample.length) return null;
  const current = sample.at(-1);
  const percentile = percentileRank(sample.map(point => point.deviation), current.deviation);
  return { ...current, percentile, score: clamp(100 - percentile), sampleSize: sample.length };
}
