const { currency, percent, date } = require('../utils/finance-format');
const DAY = 86400000;
const PERIODS = { month: 'Dieser Monat', lastMonth: 'Letzter Monat', threeMonths: 'Letzte 3 Monate', sixMonths: 'Letzte 6 Monate', year: 'Dieses Jahr', lastYear: 'Letztes Jahr', custom: 'Benutzerdefiniert' };
const WIDGETS = [
  { id: 'finance', title: 'Cashflow', w: 8, h: 6, x: 0, y: 0 },
  { id: 'categories', title: 'Ausgaben', w: 4, h: 6, x: 8, y: 0 },
  { id: 'status', title: 'Monatsstatus', w: 4, h: 5, x: 0, y: 6 },
  { id: 'forecast', title: 'Prognose Monatsende', w: 4, h: 5, x: 4, y: 6 },
  { id: 'upcoming', title: 'Kommende Zahlungen', w: 4, h: 5, x: 8, y: 6 },
  { id: 'recent', title: 'Letzte Transaktionen', w: 8, h: 8, x: 0, y: 11 },
  { id: 'insights', title: 'Finanzielle Insights', w: 4, h: 4, x: 8, y: 11 },
  { id: 'accounts', title: 'Konten', w: 4, h: 4, x: 8, y: 15 }
];
const iso = d => d.toISOString().slice(0, 10);
const day = s => new Date(s + 'T00:00:00Z');
const plusDays = (s, n) => iso(new Date(day(s).getTime() + n * DAY));
const daysBetween = (a, b) => Math.round((day(b) - day(a)) / DAY);
function validDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(day(s).getTime()) && iso(day(s)) === s && s >= '1900-01-01' && s <= '2100-12-31'; }
function shiftMonth(s, amount) {
  const d = day(s), target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + amount, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return iso(target);
}
const monthEnd = s => plusDays(shiftMonth(s.slice(0, 7) + '-01', 1), -1);
function todayInBerlin(now = new Date()) { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(now); }
function resolvePeriod(input = {}, today = todayInBerlin()) {
  const key = Object.hasOwn(PERIODS, input.period) ? input.period : 'month';
  const first = today.slice(0, 7) + '-01', year = today.slice(0, 4) + '-01-01';
  let start = first, end = today, fullEnd = monthEnd(today), previousStart, previousEnd;
  if (key === 'lastMonth') { start = shiftMonth(first, -1); end = fullEnd = plusDays(first, -1); previousStart = shiftMonth(start, -1); previousEnd = plusDays(start, -1); }
  if (key === 'threeMonths' || key === 'sixMonths') start = shiftMonth(first, key === 'threeMonths' ? -2 : -5);
  if (key === 'year') { start = year; fullEnd = today.slice(0, 4) + '-12-31'; }
  if (key === 'lastYear') { start = shiftMonth(year, -12); end = fullEnd = plusDays(year, -1); previousStart = shiftMonth(start, -12); previousEnd = plusDays(start, -1); }
  if (key === 'custom') {
    if (!validDate(input.start) || !validDate(input.end) || input.start > input.end || input.end > today || daysBetween(input.start, input.end) > 1095) {
      const error = new Error('Bitte einen gültigen Zeitraum bis heute auswählen (maximal drei Jahre).'); error.status = 422; throw error;
    }
    start = input.start; end = fullEnd = input.end;
  }
  if (!previousStart) {
    if (key === 'custom') { previousEnd = plusDays(start, -1); previousStart = plusDays(previousEnd, -daysBetween(start, end)); }
    else {
      const months = key === 'year' ? 12 : key === 'sixMonths' ? 6 : key === 'threeMonths' ? 3 : 1;
      previousStart = shiftMonth(start, -months);
      // Kalendervergleich: gleicher Monatstag, am Monatsende begrenzt; keine zukünftigen Vergleichstage.
      previousEnd = shiftMonth(end, -months);
    }
  }
  return { key, label: PERIODS[key], start, end, fullEnd, previousStart, previousEnd, today, days: daysBetween(start, end) + 1, current: start <= today && fullEnd >= today };
}
function normalizeLayout(layout) {
  if (!Array.isArray(layout) || layout.length > WIDGETS.length) return null;
  const ids = new Set(), normalized = [];
  for (const item of layout) {
    const widget = WIDGETS.find(w => w.id === item?.id);
    if (!widget || ids.has(item.id)) return null;
    ids.add(item.id);
    const entry = { ...widget, visible: item.visible !== false };
    for (const key of ['x', 'y', 'w', 'h']) {
      if (item[key] !== undefined) {
        if (!Number.isInteger(item[key]) || item[key] < (key === 'w' || key === 'h' ? 1 : 0) || item[key] > (key === 'y' ? 200 : key === 'h' ? 20 : 12)) return null;
        entry[key] = item[key];
      }
    }
    entry.h = Math.max(entry.h, widget.h); // Contents must stay readable after old layouts are migrated.
    if (entry.x + entry.w > 12) return null;
    normalized.push(entry);
  }
  // New widgets are appended to existing layouts. An empty layout restores defaults.
  if (!normalized.length) return WIDGETS.map(w => ({ ...w, visible: true }));
  let bottom = Math.max(...normalized.map(w => w.y + w.h));
  for (const widget of WIDGETS) if (!ids.has(widget.id)) { normalized.push({ ...widget, x: 0, y: bottom, visible: true }); bottom += widget.h; }
  return normalized;
}
function comparison(value, previous, hasPrevious, lowerBetter = false, percentagePoints = false) {
  if (!hasPrevious || previous === null) return { text: 'Noch keine Vergleichsdaten', tone: 'neutral' };
  const delta = value - previous;
  const tone = delta === 0 ? 'neutral' : (delta > 0) !== lowerBetter ? 'positive' : 'negative';
  if (percentagePoints) return { text: percent(delta, true).replace(' %', '') + ' Prozentpunkte zum Vergleich', tone };
  if (previous === 0) return { text: value === 0 ? 'Unverändert zum Vergleich' : 'Kein Prozentvergleich bei 0 im Vorzeitraum', tone: 'neutral' };
  return { text: percent(delta / Math.abs(previous) * 100, true) + ' zum Vergleich', tone };
}
function seriesFor(daily, period, initial, previousInitial) {
  const grouping = period.days > 100 ? 'monthly' : period.days > 14 ? 'weekly' : 'daily';
  function buckets(start, end, balance) {
    const result = [];
    for (let cursor = start; cursor <= end;) {
      const bucketEnd = [grouping === 'monthly' ? monthEnd(cursor) : plusDays(cursor, grouping === 'weekly' ? 6 : 0), end].sort()[0];
      result.push({ start: cursor, end: bucketEnd, income: 0, expense: 0 }); cursor = plusDays(bucketEnd, 1);
    }
    let index = 0;
    for (const row of daily) {
      if (row.date < start || row.date > end) continue;
      while (result[index]?.end < row.date) index++;
      if (result[index]) { result[index].income += Number(row.income); result[index].expense += Number(row.expense); }
    }
    return result.map(row => { row.income = Math.round(row.income * 100) / 100; row.expense = Math.round(row.expense * 100) / 100; row.net = Math.round((row.income - row.expense) * 100) / 100; balance = Math.round((balance + row.net) * 100) / 100; return { ...row, balance, label: grouping === 'monthly' ? day(row.start).toLocaleDateString('de-DE', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : date(row.start, true) }; });
  }
  return { grouping, current: buckets(period.start, period.end, initial), previous: buckets(period.previousStart, period.previousEnd, previousInitial) };
}
function occurrences(templates, start, end) {
  const result = [];
  for (const template of templates) {
    if (template.next_date < start || !['weekly', 'monthly', 'quarterly', 'yearly'].includes(template.frequency)) continue;
    let cursor = template.next_date;
    while (cursor <= end) {
      result.push({ ...template, date: cursor, source: 'recurring' });
      cursor = template.frequency === 'weekly' ? plusDays(cursor, 7) : shiftMonth(cursor, { monthly: 1, quarterly: 3, yearly: 12 }[template.frequency]);
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description, 'de'));
}
function buildDashboard({ period, currencyCode, budgetCurrency = currencyCode, account, accounts, aggregate, recurring, planned, budgets, reservePercent, layout }) {
  const round = n => Math.round(Number(n || 0) * 100) / 100;
  const totals = aggregate.totals;
  const selectedAccounts = accounts.filter(a => (!account || a.id === account) && a.currency === currencyCode);
  const opening = selectedAccounts.reduce((sum, a) => sum + Number(a.opening_balance), 0);
  const balance = round(opening + Number(totals.balance));
  const previousBalance = round(opening + Number(totals.previous_balance));
  const cashflow = round(Number(totals.income) - Number(totals.expense));
  const previousCashflow = round(Number(totals.previous_income) - Number(totals.previous_expense));
  const savingsRate = Number(totals.income) > 0 ? Math.max(0, cashflow) / Number(totals.income) * 100 : null;
  const previousSavingsRate = Number(totals.previous_income) > 0 ? Math.max(0, previousCashflow) / Number(totals.previous_income) * 100 : null;
  // The existing tax setting defines an estimate, not a separately held bank balance.
  const reserve = reservePercent === null ? 0 : round(Math.max(0, Number(totals.business_net)) * reservePercent / 100);
  const hasPrevious = Number(totals.previous_count) > 0;
  const hasCurrent = Number(totals.count) > 0;
  const series = seriesFor(aggregate.daily, period, opening + Number(totals.before_start), opening + Number(totals.before_previous_start));
  const categories = aggregate.categories.filter(c => Number(c.amount) > 0).map(c => ({ ...c, amount: round(c.amount), previous: round(c.previous), share: Number(totals.expense) > 0 ? Number(c.amount) / Number(totals.expense) * 100 : 0 }));
  const topCategories = categories.slice(0, 5);
  if (categories.length > 5) topCategories.push({ id: null, name: 'Sonstige', other: true, amount: round(categories.slice(5).reduce((n, c) => n + c.amount, 0)), previous: round(categories.slice(5).reduce((n, c) => n + c.previous, 0)), share: categories.slice(5).reduce((n, c) => n + c.share, 0) });
  const palette = ['#3d6bd6', '#6486c9', '#8a9bb9', '#a6b2c9', '#b8c4d9', '#d0d8e5'];
  topCategories.forEach((c, i) => { c.color = palette[i]; });
  const forecastEnd = monthEnd(period.end);
  const canForecast = period.current && period.end === period.today;
  const next = canForecast ? occurrences(recurring, period.today, forecastEnd) : [];
  const paymentKey = p => JSON.stringify([p.date, p.type, Number(p.amount), p.account_id || '', p.description.trim().toLowerCase()]);
  const plannedKeys = new Set(planned.map(paymentKey));
  // Paid and open explicitly entered payments supersede matching recurring reminders.
  const forecastItems = canForecast ? [...planned, ...next.filter(r => !plannedKeys.has(paymentKey(r)))].filter(p => !p.already_paid) : [];
  const upcoming = forecastItems.filter(p => p.type === 'expense').sort((a, b) => a.date.localeCompare(b.date));
  const expectedIncome = round(forecastItems.filter(p => p.type === 'income').reduce((n, p) => n + Number(p.amount), 0));
  const expectedExpense = round(upcoming.reduce((n, p) => n + Number(p.amount), 0));
  const forecast = { available: canForecast, end: forecastEnd, income: expectedIncome, expense: expectedExpense, balance: round(balance + expectedIncome - expectedExpense), count: forecastItems.length, overdue: recurring.filter(r => r.next_date < period.today).length };
  const globalBudget = budgets.find(b => !b.category_id);
  const monthlyBudget = globalBudget ? { amount: round(globalBudget.amount), spent: round(totals.month_expense), label: 'Monatsbudget' } : null;
  if (monthlyBudget) { monthlyBudget.remaining = round(monthlyBudget.amount - monthlyBudget.spent); monthlyBudget.progress = monthlyBudget.amount > 0 ? Math.min(100, monthlyBudget.spent / monthlyBudget.amount * 100) : 0; }
  const categoryBudgets = budgets.filter(b => b.category_id).map(b => ({ ...b, amount: round(b.amount), spent: round(b.spent) }));
  const insights = [];
  if (hasCurrent && savingsRate !== null) insights.push({ icon: 'pie-chart', text: `Du hast ${percent(savingsRate)} deiner Einnahmen im gewählten Zeitraum übrig.` });
  if (hasCurrent && hasPrevious && Number(totals.previous_expense) > 0) { const change = (Number(totals.expense) - Number(totals.previous_expense)) / Number(totals.previous_expense) * 100; if (Math.abs(change) >= 1) insights.push({ icon: change > 0 ? 'arrow-up-right' : 'arrow-down-right', text: `Deine Ausgaben sind gegenüber dem Vergleichszeitraum um ${percent(Math.abs(change))} ${change > 0 ? 'gestiegen' : 'gesunken'}.` }); }
  const unusual = categories.find(c => c.previous > 0 && c.amount >= c.previous * 1.2 && c.amount - c.previous >= 25);
  if (hasPrevious && unusual) insights.push({ icon: 'exclamation-circle', text: `${unusual.name}: ${percent((unusual.amount / unusual.previous - 1) * 100)} mehr Ausgaben als im Vergleichszeitraum (${currency(unusual.amount - unusual.previous, currencyCode)} zusätzlich).` });
  else if (categories[0]) insights.push({ icon: 'tag', text: `Deine größte Ausgabenkategorie ist ${categories[0].name} mit ${percent(categories[0].share)} deiner Ausgaben.` });
  const link = (path, params = {}) => path + '?' + new URLSearchParams({ start: period.start, end: period.end, currency: currencyCode, ...(account ? { account } : {}), ...params });
  return { period, currencyCode, budgetCurrency, account, accounts: accounts.filter(a => a.currency === currencyCode), currencies: [...new Set(accounts.map(a => a.currency).concat(currencyCode))], totals, balance, previousBalance, wealthChange: round(balance - previousBalance), wealthPercent: previousBalance > 0 ? (balance - previousBalance) / previousBalance * 100 : null, reserve, reservePercent, available: round(balance - reserve), cashflow, savingsRate, hasCurrent, hasPrevious, series, categories: topCategories, upcoming, forecast, monthlyBudget, categoryBudgets, layout: normalizeLayout(layout) || normalizeLayout([]), insights: insights.slice(0, 3), recent: aggregate.recent, money: n => currency(n, currencyCode), percent, date, link, comparisons: { income: comparison(Number(totals.income), Number(totals.previous_income), hasPrevious), expense: comparison(Number(totals.expense), Number(totals.previous_expense), hasPrevious, true), cashflow: comparison(cashflow, previousCashflow, hasPrevious), savings: comparison(savingsRate, previousSavingsRate, hasPrevious && savingsRate !== null, false, true) } };
}
module.exports = { PERIODS, WIDGETS, validDate, resolvePeriod, normalizeLayout, buildDashboard, seriesFor, occurrences, shiftMonth, monthEnd, todayInBerlin };
