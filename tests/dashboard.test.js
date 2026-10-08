const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePeriod, normalizeLayout, buildDashboard, occurrences, shiftMonth } = require('../src/services/dashboard-finance');
const { currency, percent, date } = require('../src/utils/finance-format');

function fixture(overrides = {}) {
  return {
    period: resolvePeriod({ period: 'month' }, '2026-10-08'), currencyCode: 'EUR', account: '',
    accounts: [{ id: 'main', name: 'Hauptkonto', currency: 'EUR', opening_balance: '5000', balance: '5715.96' }],
    aggregate: { totals: { income: 1843.20, expense: 1127.24, previous_income: 1640, previous_expense: 1200, count: 4, previous_count: 3, balance: 715.96, previous_balance: 391.16, before_start: 0, before_previous_start: -48.84, business_net: 0, month_expense: 1127.24, receivables: 0 }, daily: [{ date: '2026-09-05', income: 1640, expense: 1200 }, { date: '2026-10-05', income: 1843.20, expense: 1127.24 }], categories: [{ id: 'auto', name: 'Auto', amount: 1127.24, previous: 1200 }], recent: [] },
    recurring: [], planned: [], budgets: [], reservePercent: null, layout: [], ...overrides
  };
}
test('running periods compare the same calendar section; custom ranges compare equal days', () => {
  const month = resolvePeriod({ period: 'month' }, '2026-10-08');
  assert.equal(month.start, '2026-10-01'); assert.equal(month.previousStart, '2026-09-01'); assert.equal(month.previousEnd, '2026-09-08');
  const last = resolvePeriod({ period: 'lastMonth' }, '2026-10-08');
  assert.equal(last.end, '2026-09-30'); assert.equal(last.previousEnd, '2026-08-31');
  const three = resolvePeriod({ period: 'threeMonths' }, '2026-10-08');
  assert.equal(three.start, '2026-08-01'); assert.equal(three.previousStart, '2026-05-01'); assert.equal(three.previousEnd, '2026-07-08');
  const custom = resolvePeriod({ period: 'custom', start: '2026-10-02', end: '2026-10-08' }, '2026-10-08');
  assert.equal(custom.previousStart, '2026-09-25'); assert.equal(custom.previousEnd, '2026-10-01');
  assert.equal(shiftMonth('2024-03-31', -1), '2024-02-29');
});
test('invalid, future and excessively long custom dates are rejected', () => {
  for (const [start, end] of [['2026-02-30', '2026-03-01'], ['2026-10-08', '2026-10-01'], ['2026-10-01', '2026-10-09'], ['2020-01-01', '2026-10-08']]) assert.throws(() => resolvePeriod({ period: 'custom', start, end }, '2026-10-08'), { status: 422 });
});
test('opening balances, cashflow, savings and category shares use real arithmetic', () => {
  const d = buildDashboard(fixture());
  assert.equal(d.balance, 5715.96); assert.equal(d.cashflow, 715.96); assert.equal(d.wealthChange, 324.8);
  assert.ok(Math.abs(d.savingsRate - 38.843315972) < .00001); assert.equal(d.categories[0].share, 100);
  assert.equal(d.series.current.at(-1).balance, d.balance); assert.equal(d.series.previous.at(-1).balance, d.previousBalance);
  assert.equal(d.monthlyBudget, null); assert.equal(d.reserve, 0);
});
test('zero income has no savings rate; negative cashflow cannot produce a positive savings rate', () => {
  const f = fixture(); f.aggregate.totals.income = 0;
  const d = buildDashboard(f); assert.equal(d.savingsRate, null); assert.equal(d.comparisons.savings.tone, 'neutral');
  f.aggregate.totals.income = 100; assert.equal(buildDashboard(f).savingsRate, 0);
});
test('forecast counts repeated weekly occurrences and suppresses explicitly booked reminders', () => {
  const f = fixture();
  f.recurring = [{ id: 'rent', description: 'Miete', type: 'expense', amount: 100, next_date: '2026-10-08', frequency: 'weekly', account_id: 'main' }];
  f.planned = [{ description: 'Miete', type: 'expense', amount: 100, date: '2026-10-08', account_id: 'main', already_paid: true }, { description: 'Miete', type: 'expense', amount: 100, date: '2026-10-15', account_id: 'main', already_paid: false }];
  const d = buildDashboard(f); assert.equal(d.forecast.expense, 300); assert.equal(d.upcoming.length, 3); assert.equal(d.forecast.balance, 5415.96);
  assert.equal(occurrences(f.recurring, '2026-10-08', '2026-10-31').length, 4);
  f.recurring[0].next_date = '2026-10-01'; assert.equal(buildDashboard(f).forecast.overdue, 1); assert.equal(buildDashboard(f).forecast.expense, 100);
});
test('top categories preserve the full total with an honest Other bucket', () => {
  const f = fixture(); f.aggregate.categories = Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: String(i), amount: 10, previous: 0 })); f.aggregate.totals.expense = 80;
  const d = buildDashboard(f); assert.equal(d.categories.length, 6); assert.equal(d.categories.at(-1).amount, 30); assert.equal(d.categories.reduce((n, c) => n + c.share, 0), 100);
});
test('currencies and account filters never sum foreign account opening balances', () => {
  const f = fixture(); f.accounts.push({ id: 'usd', currency: 'USD', opening_balance: 100000 });
  assert.equal(buildDashboard(f).balance, 5715.96);
});
test('tax reserve is only an estimate of positive taxable business net surplus', () => {
  const f = fixture(); f.reservePercent = 30; f.aggregate.totals.business_net = 100;
  const d = buildDashboard(f); assert.equal(d.reserve, 30); assert.equal(d.available, 5685.96);
  f.aggregate.totals.business_net = -100; assert.equal(buildDashboard(f).reserve, 0);
});
test('layout rejects unknown content and unsafe coordinates; old layouts gain new widgets', () => {
  assert.equal(normalizeLayout([{ id: 'evil', content: '<script>' }]), null);
  assert.equal(normalizeLayout([{ id: 'finance', x: 10, w: 8 }]), null);
  assert.equal(normalizeLayout([{ id: 'finance', y: -1 }]), null);
  assert.equal(normalizeLayout([{ id: 'finance' }, { id: 'finance' }]), null);
  const migrated = normalizeLayout([{ id: 'finance', h: 5 }]); assert.equal(migrated.length, 8); assert.equal(migrated[0].h, 6);
  assert.equal(normalizeLayout([{ id: 'recent', visible: false }]).find(w => w.id === 'recent').visible, false);
  assert.ok(!Object.hasOwn(normalizeLayout([{ id: 'finance', content: 'ignored' }])[0], 'content'));
});
test('German currency, dates and percentages are formatted centrally', () => {
  assert.equal(currency(5687.76).replace(/\s/g, ' '), '5.687,76 €');
  assert.equal(currency(-49.62).replace(/\s/g, ' '), '-49,62 €');
  assert.equal(percent(12.4, true), '+12,4 %'); assert.equal(date('2026-10-08'), '08.10.2026');
});
