document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('#dashboard');
  const content = document.querySelector('#dashboardContent');
  const form = document.querySelector('#dashboardFilters');
  if (!root || !content || !form) return;
  const message = document.querySelector('#dashboardMessage');
  const editor = document.querySelector('#layoutEditor');
  const controls = document.querySelector('#widgetControls');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 1101px)');
  let grid, panels = new Map(), layout = [], charts = [], chartData, chartMode = 'flows', compare = true, loading = false, dirty = false;
  const titles = { finance: 'Cashflow', categories: 'Ausgaben', status: 'Monatsstatus', forecast: 'Prognose Monatsende', upcoming: 'Kommende Zahlungen', recent: 'Letzte Transaktionen', insights: 'Finanzielle Insights', accounts: 'Konten' };
  const announce = (text, error = false) => { message.textContent = text; message.classList.toggle('error', error); message.hidden = !text; };
  const money = value => new Intl.NumberFormat('de-DE', { style: 'currency', currency: chartData.currency }).format(value || 0);
  const ordered = () => [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  function captureLayout() {
    if (!grid) return;
    for (const item of grid.save(false, false, undefined, 12)) {
      const existing = layout.find(w => w.id === item.id);
      // GridStack omits dimensions equal to minW/minH from saved widgets.
      // Preserve those dimensions when switching between desktop and CSS grids.
      if (existing) for (const key of ['x', 'y', 'w', 'h']) existing[key] = item[key] ?? existing[key];
    }
  }
  function destroyCharts() { charts.forEach(chart => chart.destroy()); charts = []; }
  function drawCharts() {
    destroyCharts();
    if (!window.Chart) { announce('Die Diagramme konnten nicht geladen werden. Alle Beträge stehen weiterhin in den Listen und der Datentabelle.', true); return; }
    const style = getComputedStyle(root), muted = style.getPropertyValue('--dash-muted').trim(), border = style.getPropertyValue('--dash-border').trim(), text = style.getPropertyValue('--dash-text').trim();
    const theme = document.documentElement.dataset.bsTheme;
    const green = theme === 'dark' ? '#79c5a8' : '#2f866d', blue = theme === 'dark' ? '#8aaeed' : '#6989c4';
    const animation = reducedMotion.matches ? false : { duration: 200 };
    const tooltip = { backgroundColor: theme === 'dark' ? '#e6ecf5' : '#243149', titleColor: theme === 'dark' ? '#18212f' : '#fff', bodyColor: theme === 'dark' ? '#18212f' : '#fff', padding: 12, cornerRadius: 8, displayColors: true, callbacks: { label: context => `${context.dataset.label}: ${money(context.parsed.y)}` } };
    const current = chartData.series.current, previous = chartData.series.previous;
    const spark = content.querySelector('#wealthSparkline');
    if (spark) charts.push(new Chart(spark, { type: 'line', data: { labels: current.map(p => p.label), datasets: [{ label: 'Vermögen', data: current.map(p => p.balance), borderColor: blue, borderWidth: 1.5, backgroundColor: theme === 'dark' ? '#8aaeed10' : '#3768cd08', fill: true, tension: .25, pointRadius: 0, pointHoverRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, animation, plugins: { legend: { display: false }, tooltip: { ...tooltip } }, scales: { x: { display: false }, y: { display: false } }, interaction: { mode: 'index', intersect: false } } }));
    const canvas = content.querySelector('#cashflowChart');
    if (canvas) {
      const base = (label, rows, key, color, old = false) => ({ label, data: current.map((_, i) => rows[i]?.[key] ?? null), borderColor: color, backgroundColor: old ? 'transparent' : color + '0a', borderWidth: old ? 1.3 : 2, borderDash: old ? [4, 4] : [], tension: .22, fill: !old && chartMode === 'flows', pointRadius: current.length < 3 ? 3 : 0, pointHoverRadius: 4, pointHitRadius: 14 });
      const keys = chartMode === 'flows' ? [['Einnahmen', 'income', green], ['Ausgaben', 'expense', blue]] : chartMode === 'net' ? [['Netto-Cashflow', 'net', blue]] : [['Vermögen', 'balance', blue]];
      const datasets = keys.map(([label, key, color]) => base(label, current, key, color));
      if (compare && chartData.hasPrevious) keys.forEach(([label, key, color]) => datasets.push(base(label + ' · Vergleich', previous, key, color, true)));
      charts.push(new Chart(canvas, { type: 'line', data: { labels: current.map(p => p.label), datasets }, options: { responsive: true, maintainAspectRatio: false, animation, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { ...tooltip.callbacks, title: contexts => { const i = contexts[0]?.dataIndex; return current[i] ? `${current[i].label}${compare && previous[i] ? ' · Vergleich: ' + previous[i].label : ''}` : ''; } } } }, scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: muted, font: { size: 10 }, maxTicksLimit: 7, maxRotation: 0 } }, y: { beginAtZero: chartMode === 'flows', grid: { color: border, drawTicks: false }, border: { display: false }, ticks: { color: muted, font: { size: 10 }, maxTicksLimit: 5, padding: 8, callback: value => new Intl.NumberFormat('de-DE', { style: 'currency', currency: chartData.currency, maximumFractionDigits: 0, notation: Math.abs(value) >= 10000 ? 'compact' : 'standard' }).format(value) } } } } }));
    }
    const donut = content.querySelector('#categoryChart');
    if (donut) charts.push(new Chart(donut, { type: 'doughnut', data: { labels: chartData.categories.map(c => c.name), datasets: [{ data: chartData.categories.map(c => c.amount), backgroundColor: chartData.categories.map(c => c.color), borderColor: style.getPropertyValue('--dash-surface').trim(), borderWidth: 3, hoverOffset: reducedMotion.matches ? 0 : 4 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '78%', animation: reducedMotion.matches ? false : { duration: 200, animateRotate: false, animateScale: false }, plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: context => { const c = chartData.categories[context.dataIndex]; return `${money(c.amount)} · ${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(c.share)} %`; }, afterLabel: context => { const c = chartData.categories[context.dataIndex]; return chartData.hasPrevious ? `Vergleich: ${money(c.previous)}` : ''; } } } }, onHover: (event, elements) => { event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; }, onClick: (_, elements) => { if (elements.length) { const c = chartData.categories[elements[0].index]; const link = [...content.querySelectorAll('[data-category-name]')].find(a => a.dataset.categoryName === c.name); if (link) window.location.assign(link.href); } } } }));
    content.querySelectorAll('[data-chart-tab]').forEach(button => { const active = button.dataset.chartTab === chartMode; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
    const compareField = content.querySelector('#compareChart');
    if (compareField) compareField.checked = compare && chartData.hasPrevious;
    // Chart text is theme-aware; canvas labels are complemented by HTML tables.
    charts.forEach(chart => { chart.options.color = text; });
  }
  function renderControls() {
    controls.replaceChildren();
    const items = ordered();
    items.forEach((widget, index) => {
      const row = document.createElement('div'); row.className = 'widget-control';
      const label = document.createElement('label'), input = document.createElement('input');
      input.type = 'checkbox'; input.checked = widget.visible;
      input.addEventListener('change', () => { captureLayout(); widget.visible = input.checked; dirty = true; renderGrid(); });
      label.append(input, titles[widget.id]); row.append(label);
      for (const [step, icon, description] of [[-1, '↑', 'nach oben'], [1, '↓', 'nach unten']]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = icon;
        button.setAttribute('aria-label', `${titles[widget.id]} ${description} verschieben`);
        button.disabled = index + step < 0 || index + step >= items.length;
        button.addEventListener('click', () => {
          captureLayout(); const sorted = ordered(), target = index + step;
          [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
          let x = 0, y = 0, height = 0;
          sorted.forEach(w => { if (x + w.w > 12) { y += height; x = 0; height = 0; } w.x = x; w.y = y; x += w.w; height = Math.max(height, w.h); });
          layout = sorted; dirty = true; renderGrid();
          controls.querySelectorAll('.widget-control')[target]?.querySelector('input')?.focus();
        });
        row.append(button);
      }
      controls.append(row);
    });
  }
  function renderGrid() {
    destroyCharts();
    if (grid) { grid.destroy(false); grid = null; }
    const container = content.querySelector('.dashboard-grid');
    if (desktop.matches && window.GridStack) container.dataset.gridActive = 'true';
    else delete container.dataset.gridActive;
    container.replaceChildren();
    ordered().forEach(widget => {
      const panel = panels.get(widget.id);
      panel.hidden = false;
      for (const key of ['x', 'y', 'w', 'h']) panel.setAttribute('gs-' + key, widget[key]);
      panel.setAttribute('gs-min-h', widget.h);
      panel.removeAttribute('style');
      if (widget.visible) container.append(panel);
    });
    if (desktop.matches && window.GridStack) {
      grid = GridStack.init({ cellHeight: 80, margin: 8, column: 12, float: false, disableDrag: !editor.open, disableResize: true, handle: '.widget-handle', animate: !reducedMotion.matches }, container);
      captureLayout();
      grid.on('change', () => { captureLayout(); dirty = true; renderControls(); });
    }
    renderControls(); drawCharts();
    window.FinanceForms?.prepare(content);
  }
  function initialize(keepLayout = null) {
    destroyCharts();
    if (grid) { grid.destroy(false); grid = null; }
    const data = content.querySelector('.dashboard-data');
    chartData = JSON.parse(data.dataset.chart);
    layout = keepLayout || JSON.parse(data.dataset.layout);
    panels = new Map([...content.querySelectorAll('[data-widget-id]')].map(panel => [panel.dataset.widgetId, panel]));
    document.querySelector('#dashboardSummary').textContent = data.dataset.summary;
    renderGrid();
  }
  async function jsonRequest(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { Accept: 'application/json', ...options.headers } });
    if (response.redirected) throw new Error('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.');
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Die Anfrage konnte nicht verarbeitet werden. Bitte lade die Seite erneut.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.');
    return data;
  }
  async function refresh() {
    if (loading) return;
    if (form.elements.period.value === 'custom' && (!form.elements.start.value || !form.elements.end.value)) { announce('Bitte Start und Ende des Zeitraums angeben.', true); return; }
    const params = new URLSearchParams(new FormData(form));
    captureLayout(); const keepLayout = dirty ? layout.map(w => ({ ...w })) : null;
    loading = true; root.classList.add('dashboard-loading'); content.setAttribute('aria-busy', 'true');
    [...form.elements].forEach(field => { field.disabled = true; }); announce('Finanzübersicht wird aktualisiert …');
    try {
      const data = await jsonRequest('/api/dashboard?' + params);
      destroyCharts(); if (grid) { grid.destroy(false); grid = null; }
      content.innerHTML = data.html;
      const filters = data.filters;
      form.elements.start.value = filters.start; form.elements.end.value = filters.end;
      form.elements.currency.value = filters.currency;
      // Account options must follow the selected currency without another API call.
      const accountSelect = form.elements.account;
      accountSelect.replaceChildren(new Option('Alle Konten', ''));
      content.querySelectorAll('[data-filter-account]').forEach(button => accountSelect.add(new Option(button.querySelector('span').textContent, button.dataset.filterAccount)));
      accountSelect.value = filters.account;
      history.replaceState(null, '', '/dashboard?' + new URLSearchParams(filters));
      initialize(keepLayout); announce('');
    } catch (error) { announce(error.message, true); }
    finally { loading = false; root.classList.remove('dashboard-loading'); content.removeAttribute('aria-busy'); [...form.elements].forEach(field => { field.disabled = false; }); }
  }
  form.addEventListener('submit', event => { event.preventDefault(); refresh(); });
  form.addEventListener('change', event => {
    if (event.target.name === 'period') { const custom = event.target.value === 'custom'; document.querySelector('#customPeriod').hidden = !custom; if (custom) { form.elements.start.focus(); return; } }
    if (event.target.name === 'currency') form.elements.account.value = '';
    if (['start', 'end'].includes(event.target.name)) return;
    refresh();
  });
  content.addEventListener('click', event => {
    const tab = event.target.closest('[data-chart-tab]');
    if (tab) { chartMode = tab.dataset.chartTab; drawCharts(); }
    const account = event.target.closest('[data-filter-account]');
    if (account && !loading) { form.elements.account.value = account.dataset.filterAccount; refresh(); }
  });
  content.addEventListener('change', event => { if (event.target.id === 'compareChart') { compare = event.target.checked; drawCharts(); } });
  content.addEventListener('submit', async event => {
    const budgetForm = event.target.closest('.budget-form');
    if (!budgetForm) return;
    event.preventDefault();
    if (!window.FinanceForms?.validateForm(budgetForm)) return;
    const button = budgetForm.querySelector('button'); button.disabled = true;
    const note = budgetForm.querySelector('.budget-form-message');
    try { await jsonRequest('/dashboard/budget', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(budgetForm)) }); announce('Monatsbudget gespeichert.'); await refresh(); }
    catch (error) { note.textContent = error.message; note.classList.add('negative'); }
    finally { button.disabled = false; }
  });
  function setEditing(open) {
    editor.open = open; root.classList.toggle('editing-layout', open);
    document.querySelector('#customizeDashboard').setAttribute('aria-expanded', String(open));
    grid?.enableMove(open);
    if (open) editor.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'nearest' });
  }
  document.querySelector('#customizeDashboard').addEventListener('click', () => setEditing(!editor.open));
  document.querySelector('#closeLayout').addEventListener('click', () => { setEditing(false); document.querySelector('#customizeDashboard').focus(); });
  async function saveLayout(reset) {
    const button = document.querySelector(reset ? '#resetLayout' : '#saveLayout'); button.disabled = true;
    captureLayout();
    try {
      const data = await jsonRequest('/api/dashboard/layout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': root.dataset.csrf }, body: JSON.stringify({ layout: reset ? [] : layout }) });
      layout = data.layout; dirty = false; renderGrid(); announce(reset ? 'Standardlayout wiederhergestellt.' : 'Dashboard-Layout gespeichert.');
    } catch (error) { announce(error.message, true); }
    finally { button.disabled = false; }
  }
  document.querySelector('#saveLayout').addEventListener('click', () => saveLayout(false));
  document.querySelector('#resetLayout').addEventListener('click', () => saveLayout(true));
  desktop.addEventListener('change', () => { captureLayout(); renderGrid(); });
  reducedMotion.addEventListener('change', drawCharts);
  new MutationObserver(drawCharts).observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });
  window.addEventListener('popstate', () => window.location.reload());
  initialize();
});
