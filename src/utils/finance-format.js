const currencies = new Map();
function currencyCode(value) {
  const code = String(value || 'EUR').trim().toUpperCase();
  try { new Intl.NumberFormat('de-DE', { style: 'currency', currency: code }); return /^[A-Z]{3}$/.test(code) ? code : 'EUR'; }
  catch { return 'EUR'; }
}
function currency(value, code = 'EUR') {
  code = currencyCode(code);
  if (!currencies.has(code)) currencies.set(code, new Intl.NumberFormat('de-DE', { style: 'currency', currency: code }));
  return currencies.get(code).format(Number(value) || 0);
}
function percent(value, signed = false) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1, signDisplay: signed ? 'exceptZero' : 'auto' }).format(Number(value) || 0) + ' %';
}
function date(value, short = false) {
  return new Date(String(value).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('de-DE', short ? { day: 'numeric', month: 'short', timeZone: 'UTC' } : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}
module.exports = { currency, currencyCode, percent, date };
