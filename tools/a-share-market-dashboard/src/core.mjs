export function clamp(value, min = 0, max = 100) { return Math.min(max, Math.max(min, value)); }

export function percentileRank(values, current) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length || !Number.isFinite(current)) return null;
  return clamp((valid.filter(value => value <= current).length / valid.length) * 100);
}

export function tradingDaysForWindow(years) {
  const map = new Map([[1, 250], [3, 750], [5, 1250], [10, 2500]]);
  if (!map.has(years)) throw new RangeError(`Unsupported window: ${years}`);
  return map.get(years);
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

export const BASE_WEIGHTS = Object.freeze({
  positionShanghai: 10,
  positionCsi300: 15,
  positionCsiAll: 15,
  ttmPe: 12,
  forwardEarningsYield: 10,
  erp: 13,
  breadth: 7,
  limitBalance: 6,
  turnover: 6,
  margin: 6,
});

function round(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function positiveNumbers(values) {
  return values.filter(value => Number.isFinite(value) && value > 0);
}

function metricFromSeries(values, { reverse = false } = {}) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return null;
  const value = valid.at(-1);
  const percentile = percentileRank(valid, value);
  return {
    value: round(value),
    percentile: round(percentile),
    score: round(reverse ? 100 - percentile : percentile),
    sampleSize: valid.length,
  };
}

export function calculateValuationMetrics({
  ttmPeHistory = [],
  forwardPeHistory = [],
  bond10yHistory = [],
} = {}) {
  const ttmPe = metricFromSeries(positiveNumbers(ttmPeHistory), { reverse: true });
  const forwardPe = positiveNumbers(forwardPeHistory);
  const bondYields = bond10yHistory.filter(Number.isFinite);
  const pairCount = Math.min(forwardPe.length, bondYields.length);
  const alignedForwardPe = pairCount ? forwardPe.slice(-pairCount) : [];
  const alignedBondYields = pairCount ? bondYields.slice(-pairCount) : [];
  const earningsYields = alignedForwardPe.map(pe => 100 / pe);
  const erpValues = earningsYields.map((earningsYield, index) => earningsYield - alignedBondYields[index]);

  return {
    ttmPe,
    forwardEarningsYield: metricFromSeries(earningsYields),
    erp: metricFromSeries(erpValues),
  };
}

export function calculateWeightedScore(items) {
  const validItems = items.filter(item => Number.isFinite(item.score) && Number.isFinite(item.weight) && item.weight > 0);
  const validWeight = validItems.reduce((sum, item) => sum + item.weight, 0);
  const normalized = items.map(item => {
    const valid = Number.isFinite(item.score) && Number.isFinite(item.weight) && item.weight > 0 && validWeight > 0;
    const rawEffectiveWeight = valid ? item.weight / validWeight * 100 : 0;
    return {
      ...item,
      effectiveWeight: round(rawEffectiveWeight),
      contribution: valid ? round(item.score * rawEffectiveWeight / 100) : 0,
    };
  });
  const score = validWeight
    ? round(validItems.reduce((sum, item) => sum + item.score * item.weight, 0) / validWeight)
    : null;
  return {
    score,
    coverage: round(Math.min(100, validWeight)),
    items: normalized,
  };
}

export function calculateGreedMetrics({
  advancers,
  decliners,
  limitUp,
  limitDown,
  turnoverPercentile,
  marginChangePercentile,
} = {}) {
  const breadthTotal = advancers + decliners;
  const limitTotal = limitUp + limitDown;
  const components = {
    breadth: {
      id: 'breadth',
      score: Number.isFinite(breadthTotal) && breadthTotal > 0 ? clamp(advancers / breadthTotal * 100) : null,
      weight: BASE_WEIGHTS.breadth,
    },
    limitBalance: {
      id: 'limitBalance',
      score: Number.isFinite(limitTotal) && limitTotal > 0 ? clamp(limitUp / limitTotal * 100) : null,
      weight: BASE_WEIGHTS.limitBalance,
    },
    turnover: {
      id: 'turnover',
      score: Number.isFinite(turnoverPercentile) ? clamp(turnoverPercentile) : null,
      weight: BASE_WEIGHTS.turnover,
    },
    margin: {
      id: 'margin',
      score: Number.isFinite(marginChangePercentile) ? clamp(marginChangePercentile) : null,
      weight: BASE_WEIGHTS.margin,
    },
  };
  const weighted = calculateWeightedScore(Object.values(components));
  return {
    components,
    greed: weighted.score,
    buyScore: weighted.score === null ? null : round(100 - weighted.score),
    coverage: weighted.coverage,
  };
}

export function conclusionForScore(score, coverage) {
  if (!Number.isFinite(score) || !Number.isFinite(coverage) || coverage < 70) {
    return { label: '数据不足，暂不判断', band: 'insufficient', actionable: false };
  }
  if (score >= 80) return { label: '别人恐惧，可以贪婪', band: 'greedy', actionable: true };
  if (score >= 65) return { label: '偏便宜，分批关注', band: 'cheap', actionable: true };
  if (score >= 45) return { label: '中性，等待赔率改善', band: 'neutral', actionable: true };
  if (score >= 25) return { label: '偏贵，控制冲动', band: 'expensive', actionable: true };
  return { label: '市场贪婪，应该恐惧', band: 'fearful', actionable: true };
}
