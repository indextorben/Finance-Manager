const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const audit = require('../utils/audit');
const { parseAmount } = require('../utils/amount');
const { loadDashboard } = require('../services/dashboard-data');
const { PERIODS, WIDGETS, normalizeLayout } = require('../services/dashboard-finance');
const router = express.Router();
router.use((req, res, next) => {
  if (req.path === '/dashboard' || req.path.startsWith('/api/dashboard')) res.set('Cache-Control', 'no-store');
  next();
});
function filtersFor(req) {
  const keys = ['period', 'start', 'end', 'account', 'currency'];
  const saved = req.session.dashboardFilters || {};
  const explicit = keys.some(k => Object.hasOwn(req.query, k));
  return explicit ? Object.fromEntries(keys.filter(k => typeof req.query[k] === 'string').map(k => [k, req.query[k]])) : saved;
}
function remember(req, dashboard) {
  req.session.dashboardFilters = { period: dashboard.period.key, start: dashboard.period.start, end: dashboard.period.end, account: dashboard.account, currency: dashboard.currencyCode };
}
router.get('/dashboard', auth, async (req, res) => {
  try {
    const dashboard = await loadDashboard(req.session.user, filtersFor(req));
    remember(req, dashboard);
    res.render('dashboard', { dashboard, periods: PERIODS, widgets: WIDGETS, dashboardError: null, pageTitle: 'Finanzübersicht' });
  } catch (error) {
    res.status(error.status || 503).render('dashboard', { dashboard: null, periods: PERIODS, widgets: WIDGETS, dashboardError: error.status === 422 ? error.message : 'Deine Finanzübersicht konnte nicht geladen werden. Bitte versuche es erneut.', pageTitle: 'Finanzübersicht' });
  }
});
router.get('/api/dashboard', auth, async (req, res) => {
  try {
    const dashboard = await loadDashboard(req.session.user, filtersFor(req));
    remember(req, dashboard);
    res.set('Cache-Control', 'no-store');
    res.render('dashboard/content', { dashboard }, (error, html) => {
      if (error) return res.status(500).json({ error: 'Die Finanzübersicht konnte nicht dargestellt werden.' });
      res.json({ html, filters: req.session.dashboardFilters });
    });
  } catch (error) { res.status(error.status || 503).json({ error: error.status === 422 ? error.message : 'Deine Finanzübersicht konnte nicht geladen werden. Bitte versuche es erneut.' }); }
});
router.get('/api/dashboard/layout', auth, async (req, res) => {
  const row = (await db.query('SELECT layout FROM dashboard_layouts WHERE user_id=$1', [req.session.user.id])).rows[0];
  res.json(normalizeLayout(row?.layout || []) || normalizeLayout([]));
});
router.post('/api/dashboard/layout', auth, async (req, res) => {
  const layout = normalizeLayout(req.body.layout);
  if (!layout) return res.status(422).json({ error: 'Das Dashboard-Layout ist ungültig.' });
  await db.query('INSERT INTO dashboard_layouts(user_id,layout) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET layout=EXCLUDED.layout,updated_at=now()', [req.session.user.id, JSON.stringify(layout)]);
  res.json({ ok: true, layout });
});
router.post('/dashboard/budget', auth, async (req, res) => {
  const amount = parseAmount(req.body.amount, { allowNegative: false });
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999.99) return res.status(422).json({ error: 'Bitte ein Monatsbudget größer als 0,00 eingeben.' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Serialize setup without adding a migration or duplicate global budgets.
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [req.session.user.id]);
    const existing = (await client.query("SELECT id FROM budgets WHERE user_id=$1 AND category_id IS NULL AND period='monthly' ORDER BY created_at DESC LIMIT 1", [req.session.user.id])).rows[0];
    if (existing) await client.query('UPDATE budgets SET amount=$1,active=true WHERE id=$2', [amount, existing.id]);
    else await client.query("INSERT INTO budgets(user_id,amount,period) VALUES($1,$2,'monthly')", [req.session.user.id, amount]);
    await client.query("UPDATE budgets SET active=false WHERE user_id=$1 AND category_id IS NULL AND period='monthly' AND id<>(SELECT id FROM budgets WHERE user_id=$1 AND category_id IS NULL AND period='monthly' ORDER BY created_at DESC LIMIT 1)", [req.session.user.id]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  await audit(req, 'dashboard.budget', 'budget', null, { amount });
  if (req.accepts(['html', 'json']) === 'json') return res.json({ ok: true });
  res.redirect('/dashboard');
});
router.use((error, req, res, next) => {
  if (req.path.startsWith('/api/dashboard') || (req.path === '/dashboard/budget' && req.accepts(['html', 'json']) === 'json')) {
    return res.status(error.status || 503).json({ error: 'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.' });
  }
  next(error);
});
module.exports = router;
