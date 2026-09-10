import test from 'node:test';
import assert from 'node:assert/strict';
import { parseValuationListDetails, renderValuationListCell, trackingPriceToMidpoint } from '../src/app.mjs';

test('list distinguishes payoff magnitudes from assumed win probabilities', () => {
  const details = parseValuationListDetails('14.46—22.07元；中枢18.53元', '现价19.55元（9月7日） 上涨12.89% / 下跌26.03%；盈亏平衡概率66.8799% 假设上涨概率70%');
  assert.equal(details.midpoint, '18.53');
  assert.equal(details.kellyUpside, '12.89%');
  assert.equal(details.kellyDownside, '26.03%');
  assert.equal(details.kellyBreakEven, '66.8799%');
  const html = renderValuationListCell({ valueRange: '14.46—22.07元', ...details });
  assert.match(html, /中枢：18.53元/);
  assert.match(html, /研报价：19.55元（9月7日）/);
  assert.match(html, /盈亏比：0.50:1/);
  assert.doesNotMatch(html, /<small>上涨空间：|<small>下跌幅度：/);
  assert.doesNotMatch(html, /上涨概率：12.89/);
});

test('payoff ratio uses report returns and rejects missing or zero downside', () => {
  assert.match(renderValuationListCell({ kellyUpside: '42.56%', kellyDownside: '17.77%' }), /盈亏比：2.40:1/);
  for (const downside of ['', '0%', undefined]) {
    assert.match(renderValuationListCell({ kellyUpside: '40%', kellyDownside: downside }), /盈亏比：未获取到/);
  }
});

test('midpoint ratio retains precision for sorting and treats invalid inputs as missing', () => {
  assert.equal(trackingPriceToMidpoint(5.97, '10'), 0.597);
  assert.equal(trackingPriceToMidpoint(12, '10'), 1.2);
  for (const midpoint of ['', '0', '-1', 'bad', undefined]) {
    assert.equal(trackingPriceToMidpoint(10, midpoint), null);
  }
  assert.equal(trackingPriceToMidpoint(undefined, '10'), null);
});

test('supports explicit space labels and does not calculate a missing midpoint', () => {
  const details = parseValuationListDetails('16.95—33.13元；中枢24.18元', '上涨空间：0.0256%；下跌空间：48.81% 盈亏平衡概率：99.9477%');
  assert.equal(details.kellyUpside, '0.0256%');
  assert.equal(details.kellyDownside, '48.81%');
  assert.equal(parseValuationListDetails('20—30元', '假设上涨概率50%—90%').midpoint, '');
  assert.equal(parseValuationListDetails('', '假设上涨概率50%—90%').kellyUpside, '');
});

test('outside-range and missing reports retain evidence boundaries', () => {
  const details = parseValuationListDetails('29.61—48.44元；中枢40.02元', '现价50.00元（9月7日）到上限回报−3.13%；盈亏平衡概率不适用');
  assert.match(renderValuationListCell(details), /凯利：不适用/);
  assert.doesNotMatch(renderValuationListCell(details), /盈亏平衡概率：0/);
  assert.match(renderValuationListCell(), /中枢：未获取到/);
  assert.match(renderValuationListCell(), /凯利：未获取到/);
});
