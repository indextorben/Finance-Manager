const db = require('../config/db');
const { currencyCode } = require('../utils/finance-format');
const { resolvePeriod, buildDashboard, monthEnd, todayInBerlin } = require('./dashboard-finance');

async function loadAccountBalances(client, userId, asOf = todayInBerlin()) {
  return (await client.query(`SELECT a.*,
    a.opening_balance + COALESCE(SUM(CASE t.type WHEN 'income' THEN t.gross_amount ELSE -t.gross_amount END)
    FILTER(WHERE NOT t.archived AND t.status='paid' AND COALESCE(t.payment_date,t.tx_date)<=$2::date),0) balance
    FROM accounts a LEFT JOIN transactions t ON t.account_id=a.id AND t.user_id=a.user_id
    WHERE a.user_id=$1 GROUP BY a.id ORDER BY a.archived,a.name`, [userId, asOf])).rows;
}

// One consistent snapshot. Transactions are aggregated in PostgreSQL; individual
// rows sent to the browser are bounded, even for years of financial history.
async function loadDashboard(user, filters) {
  const period = resolvePeriod(filters);
  const client = await db.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const accounts = await loadAccountBalances(client, user.id, period.end);
    const account = typeof filters.account === 'string' ? filters.account : '';
    const selected = accounts.find(a => a.id === account);
    if (account && !selected) { const error = new Error('Das gewählte Konto ist nicht verfügbar.'); error.status = 422; throw error; }
    const code = selected ? currencyCode(selected.currency) : currencyCode(filters.currency || user.currency);
    const userCurrency = currencyCode(user.currency);
    // A booking without an account uses the profile currency. Foreign currencies
    // are never added together without an exchange-rate model.
    const scope = `t.user_id=$1 AND NOT t.archived AND ($2::uuid IS NULL OR t.account_id=$2::uuid)
      AND (a.currency=$3 OR (t.account_id IS NULL AND $3=$8))`;
    const params = [user.id, account || null, code, period.start, period.end, period.previousStart, period.previousEnd, userCurrency];
    const aggregate = (await client.query(`WITH scoped AS MATERIALIZED (
      SELECT t.id,t.type,t.tx_date,t.gross_amount,t.net_amount,t.account_id,t.category_id,t.status,t.scope,
        t.tax_relevant,t.description,t.merchant,t.created_at,COALESCE(t.payment_date,t.tx_date) cash_date,
        a.name account,c.name category,c.icon category_icon
      FROM transactions t LEFT JOIN accounts a ON a.id=t.account_id AND a.user_id=t.user_id
      LEFT JOIN categories c ON c.id=t.category_id AND c.user_id=t.user_id WHERE ${scope}
    ), paid AS MATERIALIZED (SELECT * FROM scoped WHERE status='paid'), totals AS (
      SELECT COALESCE(SUM(gross_amount) FILTER(WHERE type='income' AND cash_date BETWEEN $4::date AND $5::date),0) income,
        COALESCE(SUM(gross_amount) FILTER(WHERE type='expense' AND cash_date BETWEEN $4::date AND $5::date),0) expense,
        count(*) FILTER(WHERE cash_date BETWEEN $4::date AND $5::date) count,
        COALESCE(SUM(gross_amount) FILTER(WHERE type='income' AND cash_date BETWEEN $6::date AND $7::date),0) previous_income,
        COALESCE(SUM(gross_amount) FILTER(WHERE type='expense' AND cash_date BETWEEN $6::date AND $7::date),0) previous_expense,
        count(*) FILTER(WHERE cash_date BETWEEN $6::date AND $7::date) previous_count,
        COALESCE(SUM(CASE type WHEN 'income' THEN gross_amount ELSE -gross_amount END) FILTER(WHERE cash_date<=$5::date),0) balance,
        COALESCE(SUM(CASE type WHEN 'income' THEN gross_amount ELSE -gross_amount END) FILTER(WHERE cash_date<=$7::date),0) previous_balance,
        COALESCE(SUM(CASE type WHEN 'income' THEN gross_amount ELSE -gross_amount END) FILTER(WHERE cash_date<$4::date),0) before_start,
        COALESCE(SUM(CASE type WHEN 'income' THEN gross_amount ELSE -gross_amount END) FILTER(WHERE cash_date<$6::date),0) before_previous_start,
        COALESCE(SUM(CASE type WHEN 'income' THEN net_amount ELSE -net_amount END) FILTER(WHERE scope='business' AND tax_relevant AND cash_date BETWEEN $4::date AND $5::date),0) business_net,
        COALESCE(SUM(gross_amount) FILTER(WHERE type='expense' AND cash_date BETWEEN date_trunc('month',$5::date)::date AND $5::date),0) month_expense
      FROM paid
    ), daily AS (
      SELECT to_char(cash_date,'YYYY-MM-DD') date,
        COALESCE(SUM(gross_amount) FILTER(WHERE type='income'),0) income,
        COALESCE(SUM(gross_amount) FILTER(WHERE type='expense'),0) expense
      FROM paid WHERE cash_date BETWEEN LEAST($4::date,$6::date) AND GREATEST($5::date,$7::date)
      GROUP BY cash_date ORDER BY cash_date
    ), categories AS (
      SELECT category_id id,COALESCE(category,'Ohne Kategorie') name,
        COALESCE(SUM(gross_amount) FILTER(WHERE cash_date BETWEEN $4::date AND $5::date),0) amount,
        COALESCE(SUM(gross_amount) FILTER(WHERE cash_date BETWEEN $6::date AND $7::date),0) previous
      FROM paid WHERE type='expense' AND (cash_date BETWEEN $4::date AND $5::date OR cash_date BETWEEN $6::date AND $7::date)
      GROUP BY category_id,category ORDER BY amount DESC,name
    ), recent AS (
      SELECT id,type,description,merchant,gross_amount,status,category,category_icon,account,
        to_char(CASE WHEN status='paid' THEN cash_date ELSE tx_date END,'YYYY-MM-DD') date
      FROM scoped WHERE status NOT IN('draft','cancelled') AND
        CASE WHEN status='paid' THEN cash_date ELSE tx_date END BETWEEN $4::date AND $5::date
      ORDER BY CASE WHEN status='paid' THEN cash_date ELSE tx_date END DESC,created_at DESC,id DESC LIMIT 7
    ), receivables AS (
      SELECT COALESCE(SUM(t.gross_amount),0) amount FROM scoped t WHERE type='income' AND status IN('open','overdue') AND tx_date BETWEEN $4::date AND $5::date
    ), invoice_receivables AS (
      SELECT COALESCE(SUM(i.gross_amount),0) amount FROM invoices i LEFT JOIN scoped t ON t.id=i.transaction_id
      WHERE i.user_id=$1 AND i.status IN('open','overdue') AND i.invoice_date BETWEEN $4::date AND $5::date
        AND (($2::uuid IS NULL AND $3=$8 AND i.transaction_id IS NULL) OR t.id IS NOT NULL)
        AND (t.id IS NULL OR (t.status<>'paid' AND NOT (t.status IN('open','overdue') AND t.tx_date BETWEEN $4::date AND $5::date)))
    ) SELECT jsonb_build_object('totals',(SELECT to_jsonb(totals)||jsonb_build_object('receivables',(SELECT amount FROM receivables)+(SELECT amount FROM invoice_receivables)) FROM totals),
      'daily',COALESCE((SELECT jsonb_agg(daily) FROM daily),'[]'::jsonb),
      'categories',COALESCE((SELECT jsonb_agg(categories) FROM categories),'[]'::jsonb),
      'recent',COALESCE((SELECT jsonb_agg(recent) FROM recent),'[]'::jsonb)) data`, params)).rows[0].data;
    const recurring = (await client.query(`SELECT r.id,r.type,r.description,r.amount,r.frequency,r.account_id,
      to_char(r.next_date,'YYYY-MM-DD') next_date,a.name account
      FROM recurring_transactions r LEFT JOIN accounts a ON a.id=r.account_id AND a.user_id=r.user_id
      WHERE r.user_id=$1 AND r.active AND ($2::uuid IS NULL OR r.account_id=$2::uuid)
        AND (a.currency=$3 OR (r.account_id IS NULL AND $3=$4)) AND r.next_date<=$5::date
      ORDER BY r.next_date`, [user.id, account || null, code, userCurrency, monthEnd(period.end)])).rows;
    // Linked invoices are represented by their transaction, never by both rows.
    const planned = (await client.query(`SELECT t.id,t.type,t.description,t.gross_amount amount,t.account_id,a.name account,
      to_char(COALESCE(t.payment_date,t.tx_date),'YYYY-MM-DD') date,'transaction' source,
      (t.status='paid' AND COALESCE(t.payment_date,t.tx_date)<=$4::date) already_paid
      FROM transactions t LEFT JOIN accounts a ON a.id=t.account_id AND a.user_id=t.user_id
      WHERE ${scope.replaceAll('$8', '$6')} AND t.status IN('paid','open','overdue') AND COALESCE(t.payment_date,t.tx_date) BETWEEN $4::date AND $5::date
      UNION ALL SELECT i.id,'income','Rechnung '||i.invoice_number,i.gross_amount,NULL::uuid,NULL::varchar,
        to_char(i.due_date,'YYYY-MM-DD'),'invoice',false
      FROM invoices i WHERE i.user_id=$1 AND i.status IN('open','overdue') AND i.transaction_id IS NULL
        AND $2::uuid IS NULL AND $3=$6 AND i.due_date BETWEEN $4::date AND $5::date`,
    [user.id, account || null, code, period.today, monthEnd(period.end), userCurrency])).rows;
    const budgets = (await client.query(`WITH monthly_spent AS (
      SELECT t.category_id,SUM(t.gross_amount) amount FROM transactions t
      LEFT JOIN accounts a ON a.id=t.account_id AND a.user_id=t.user_id
      WHERE ${scope.replaceAll('$8', '$5')} AND t.type='expense' AND t.status='paid'
        AND COALESCE(t.payment_date,t.tx_date) BETWEEN date_trunc('month',$4::date)::date AND $4::date
      GROUP BY t.category_id
    ) SELECT b.*,COALESCE(c.name,'Kategorie') name,COALESCE(s.amount,0) spent
      FROM budgets b LEFT JOIN categories c ON c.id=b.category_id AND c.user_id=b.user_id
      LEFT JOIN monthly_spent s ON s.category_id=b.category_id
      WHERE b.user_id=$1 AND b.active AND b.period='monthly' AND $3=$5 ORDER BY b.created_at DESC`, [user.id, account || null, code, period.end, userCurrency])).rows;
    const settings = (await client.query(`SELECT
      (SELECT reserve_percent FROM tax_settings WHERE user_id=$1) reserve_percent,
      (SELECT layout FROM dashboard_layouts WHERE user_id=$1) layout`, [user.id])).rows[0];
    await client.query('COMMIT');
    return buildDashboard({ period, currencyCode: code, budgetCurrency: userCurrency, account, accounts, aggregate, recurring, planned, budgets, reservePercent: settings.reserve_percent === null ? null : Number(settings.reserve_percent), layout: settings.layout || [] });
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
module.exports = { loadDashboard, loadAccountBalances };
