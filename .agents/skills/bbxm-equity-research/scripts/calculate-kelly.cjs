// Binary terminal-value scenario, zero cash return, no dividends or costs.
function calculateKelly({ price, low, high, probability }) {
  if (![price, low, high, probability].every(Number.isFinite)
      || price <= 0 || low < 0 || high <= low || probability < 0 || probability > 1) {
    throw new Error('需要有效价格、0≤下限<上限及0—1之间的概率。');
  }
  const gain = high / price - 1;
  const loss = 1 - low / price;
  if (gain <= 0 || loss <= 0) {
    return { gain, loss, status: '不适用：需要下限 < 现价 < 上限；区间外须重建盈亏情景', raw: null, full: null, half: null, breakEvenProbability: null };
  }
  const raw = probability / loss - (1 - probability) / gain;
  const full = Math.min(1, Math.max(0, raw));
  return { gain, loss, odds: gain / loss, breakEvenProbability: loss / (gain + loss), probability, raw, full, half: full / 2, status: '情景测算' };
}

module.exports = { calculateKelly };
if (require.main === module) {
  const [price, low, high, ...probabilities] = process.argv.slice(2).map(Number);
  if (!probabilities.length) throw new Error('用法：node calculate-kelly.cjs 现价 下限 上限 概率 [概率...]');
  console.log(JSON.stringify(probabilities.map((probability) => calculateKelly({ price, low, high, probability })), null, 2));
}
