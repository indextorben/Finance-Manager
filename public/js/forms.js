/* Formular-Hilfen:
   1. Fehlende oder falsche Angaben werden direkt am Feld und als Liste oben im Formular angezeigt.
   2. Betragsfelder ([data-money]) setzen Tausenderpunkte automatisch; eingetippt wird nur Komma. */
(() => {
  'use strict';

  /* ---------------------------------------------------------------- Beträge */

  const MONEY_FORMAT = /^(\d{1,3}(\.\d{3})*|\d+)(,\d{1,2})?$/;

  const isSigned = el => el.dataset.money === 'signed';

  // Rohtext in Vorzeichen / Ganzzahl / Dezimalstellen zerlegen. Punkte setzt das Feld
  // selbst, deshalb werden sie beim Tippen verworfen; "smart" gilt für eingefügte Werte,
  // bei denen ein Punkt auch der Dezimaltrenner sein kann ("12.50").
  function splitAmount(raw, smart) {
    const neg = /^\s*-/.test(raw);
    let s = String(raw).replace(/[^\d.,]/g, '');
    let dec = null;
    if (s.includes(',')) {
      const i = s.indexOf(',');
      dec = s.slice(i + 1).replace(/\D/g, '').slice(0, 2);
      s = s.slice(0, i);
    } else if (smart) {
      const m = s.match(/^(\d*)\.(\d{1,2})$/);
      if (m) { s = m[1]; dec = m[2]; }
    }
    return { neg, int: s.replace(/\D/g, '').replace(/^0+(?=\d)/, ''), dec };
  }

  const group = int => int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  function joinAmount({ neg, int, dec }, signed) {
    let out = group(int);
    if (dec !== null) out = (out || '0') + ',' + dec;
    if (!out) return neg && signed ? '-' : '';
    return (neg && signed ? '-' : '') + out;
  }

  // "1234.56" (Datenbank) -> "1.234,56" (Anzeige)
  function formatAmount(value, decimals = 2) {
    const n = Number(String(value ?? '').replace(',', '.'));
    if (!Number.isFinite(n)) return '';
    const [int, dec] = Math.abs(n).toFixed(decimals).split('.');
    return (n < 0 ? '-' : '') + group(int) + (dec ? ',' + dec : '');
  }

  // "1.234,56" (Anzeige) -> 1234.56 (Zahl)
  function amountValue(text) {
    const { neg, int, dec } = splitAmount(text);
    if (!int && !dec) return NaN;
    const n = Number((int || '0') + '.' + (dec || '0'));
    return Number.isFinite(n) ? (neg ? -n : n) : NaN;
  }

  const countSignificant = s => (s.match(/[\d,-]/g) || []).length;

  function caretAfter(formatted, significant) {
    if (significant <= 0) return 0;
    let seen = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (/[\d,-]/.test(formatted[i])) seen++;
      if (seen >= significant) return i + 1;
    }
    return formatted.length;
  }

  function setCaret(el, pos) {
    try { el.setSelectionRange(pos, pos); } catch (_) { /* unterstützt der Browser nicht */ }
  }

  function reformat(el, smart) {
    const before = el.value.slice(0, el.selectionStart ?? el.value.length);
    const formatted = joinAmount(splitAmount(el.value, smart), isSigned(el));
    if (formatted === el.value) return;
    const caret = caretAfter(formatted, countSignificant(before));
    el.value = formatted;
    setCaret(el, caret);
  }

  // Punkt und Komma meinen beide den Dezimaltrenner – Tausenderpunkte kommen automatisch.
  // Ein getippter Punkt gilt zunächst als Komma (Merker "autoComma"), siehe absorbOverflow.
  function insertSeparator(el, auto) {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const existing = el.value.indexOf(',');
    if (existing > -1 && !(start <= existing && end > existing)) { setCaret(el, existing + 1); return; }
    el.value = el.value.slice(0, start) + ',' + el.value.slice(end);
    el.dataset.autoComma = auto ? '1' : '';
    setCaret(el, start + 1);
    reformat(el);
  }

  // "1.234" tippt sich wie gewohnt: kommen nach einem getippten Punkt mehr als zwei
  // Ziffern, war der Punkt als Tausenderpunkt gemeint und die Stellen wandern zurück.
  function absorbOverflow(el) {
    if (el.dataset.autoComma !== '1') return false;
    const i = el.value.indexOf(',');
    if (i < 0) return false;
    const dec = el.value.slice(i + 1).replace(/\D/g, '');
    if (dec.length <= 2) return false;
    const int = el.value.slice(0, i).replace(/\D/g, '');
    el.dataset.autoComma = '';
    el.value = joinAmount({ neg: /^-/.test(el.value), int: (int + dec).replace(/^0+(?=\d)/, ''), dec: null }, isSigned(el));
    setCaret(el, el.value.length);
    return true;
  }

  // Beim Verlassen des Feldes auf zwei Nachkommastellen auffüllen.
  function completeAmount(el) {
    const parts = splitAmount(el.value);
    if (!parts.int && !parts.dec) { el.value = ''; return; }
    if (parts.dec === null) parts.dec = '00';
    else while (parts.dec.length < 2) parts.dec += '0';
    if (!parts.int) parts.int = '0';
    el.value = joinAmount(parts, isSigned(el));
  }

  function prepareMoney(el) {
    if (el.dataset.moneyReady) return;
    el.dataset.moneyReady = '1';
    el.setAttribute('inputmode', 'decimal');
    el.setAttribute('autocomplete', 'off');
    if (el.value) completeAmount(el);
    el.addEventListener('beforeinput', event => {
      if (event.data === '.' || event.data === ',') { event.preventDefault(); insertSeparator(el, event.data === '.'); }
    });
    el.addEventListener('input', event => {
      const pasted = event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop';
      if (pasted) el.dataset.autoComma = '';
      else if (absorbOverflow(el)) return;
      reformat(el, pasted);
      if (pasted) setCaret(el, el.value.length);
    });
    el.addEventListener('blur', () => { el.dataset.autoComma = ''; completeAmount(el); checkField(el, true); });
  }

  const moneyFields = root => root.querySelectorAll('input[data-money]:not([data-money-ready])');

  /* ------------------------------------------------------- Feldbeschriftung */

  const tidy = t => t.replace(/\s+/g, ' ').replace(/\(optional\)/i, '').trim().replace(/[:*]+$/, '').trim();

  function labelOf(el) {
    if (el.dataset.fieldLabel) return el.dataset.fieldLabel;
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) return tidy(l.textContent);
    }
    const own = el.closest('label');
    if (own) return tidy(own.textContent);
    let node = el.parentElement;
    for (let i = 0; i < 4 && node; i++, node = node.parentElement) {
      const l = node.querySelector('.form-label, label');
      if (l) return tidy(l.textContent);
    }
    return el.placeholder || el.name || 'Feld';
  }

  /* ------------------------------------------------------------- Meldungen */

  function moneyProblem(el) {
    const label = labelOf(el);
    const raw = el.value.trim();
    if (!raw) { el.setCustomValidity(''); return; }   // "required" meldet sich selbst
    if (!MONEY_FORMAT.test(raw.replace(/^-/, '')) || (raw.startsWith('-') && !isSigned(el))) {
      el.setCustomValidity(raw.startsWith('-') && !isSigned(el)
        ? `${label} darf nicht negativ sein.`
        : 'Bitte einen Betrag wie 1.234,56 eingeben.');
      return;
    }
    const n = amountValue(raw);
    const min = el.dataset.minAmount;
    if (min !== undefined && !(n >= Number(min))) {
      el.setCustomValidity(`${label} muss mindestens ${formatAmount(min)} € betragen.`);
      return;
    }
    el.setCustomValidity('');
  }

  function messageFor(el, label) {
    const v = el.validity;
    if (v.customError) return el.validationMessage;
    if (v.valueMissing) {
      if (el.tagName === 'SELECT') return `Bitte ${label} auswählen.`;
      if (el.type === 'checkbox' || el.type === 'radio') return `Bitte ${label} bestätigen.`;
      if (el.type === 'file') return `Bitte eine Datei für ${label} auswählen.`;
      if (el.type === 'date') return `Bitte ${label} angeben.`;
      return `Bitte ${label} angeben.`;
    }
    if (v.typeMismatch) return el.type === 'email'
      ? 'Bitte eine gültige E-Mail-Adresse angeben.'
      : `${label}: Das Format passt nicht.`;
    if (v.rangeUnderflow) return `${label}: mindestens ${el.min}.`;
    if (v.rangeOverflow) return `${label}: höchstens ${el.max}.`;
    if (v.tooShort) return `${label}: mindestens ${el.minLength} Zeichen.`;
    if (v.tooLong) return `${label}: höchstens ${el.maxLength} Zeichen.`;
    if (v.stepMismatch) return `${label}: Bitte einen gültigen Wert eingeben.`;
    if (v.patternMismatch) return el.dataset.hint || `${label}: Bitte das vorgegebene Format verwenden.`;
    return el.validationMessage || `${label}: Bitte prüfen.`;
  }

  /* ------------------------------------------------------- Anzeige am Feld */

  const host = el => el.closest('.input-group') || el.closest('.form-check') || el;

  function showProblem(el, msg) {
    el.classList.add('is-invalid');
    el.setAttribute('aria-invalid', 'true');
    const anchor = host(el);
    let note = anchor.nextElementSibling;
    if (!note?.classList.contains('field-error')) {
      note = document.createElement('div');
      note.className = 'invalid-feedback d-block field-error';
      anchor.after(note);
    }
    note.textContent = msg;
  }

  function clearProblem(el) {
    el.classList.remove('is-invalid');
    el.removeAttribute('aria-invalid');
    const note = host(el).nextElementSibling;
    if (note?.classList.contains('field-error')) note.remove();
  }

  function validatable(form) {
    return Array.from(form.elements).filter(el =>
      el.willValidate && el.name !== '_csrf' && el.type !== 'hidden' && !el.disabled);
  }

  function checkField(el, show) {
    if (!el.willValidate) return true;
    if (el.dataset.money !== undefined) moneyProblem(el);
    if (el.checkValidity()) { clearProblem(el); updateSummary(el.form); return true; }
    if (show || el.classList.contains('is-invalid')) {
      showProblem(el, messageFor(el, labelOf(el)));
      updateSummary(el.form);
    }
    return false;
  }

  /* ----------------------------------------------------- Zusammenfassung */

  const summaryHost = form => form.querySelector('.modal-body') || form.querySelector('.card-body') || form;

  function updateSummary(form) {
    if (!form) return;
    const box = form.querySelector('.form-summary');
    if (!box) return;
    const problems = validatable(form).filter(el => el.classList.contains('is-invalid'));
    if (!problems.length) { box.remove(); return; }
    renderSummary(form, problems.map(el => ({ el, label: labelOf(el), msg: host(el).nextElementSibling?.textContent || '' })));
  }

  function renderSummary(form, problems) {
    let box = form.querySelector('.form-summary');
    if (!problems.length) { box?.remove(); return; }
    if (!box) {
      box = document.createElement('div');
      box.className = 'alert alert-danger form-summary';
      box.setAttribute('role', 'alert');
      const target = summaryHost(form);
      target.insertBefore(box, target.firstChild);
    }
    box.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'fw-semibold mb-1';
    title.innerHTML = '<i class="bi bi-exclamation-circle-fill me-1"></i>';
    title.append(problems.length === 1 ? 'Eine Angabe fehlt oder ist nicht gültig' : `${problems.length} Angaben fehlen oder sind nicht gültig`);
    box.append(title);
    const list = document.createElement('ul');
    list.className = 'mb-0 ps-3';
    problems.forEach(({ el, label, msg }) => {
      const item = document.createElement('li');
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'btn btn-link p-0 align-baseline text-start text-danger';
      link.textContent = `${label}: ${msg.replace(/^Bitte /, 'bitte ')}`;
      link.addEventListener('click', () => focusField(el));
      item.append(link);
      list.append(item);
    });
    box.append(list);
  }

  function focusField(el) {
    try { el.focus({ preventScroll: true }); } catch (_) { try { el.focus(); } catch (__) { /* egal */ } }
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) { /* egal */ }
  }

  /* ------------------------------------------------------------- Formulare */

  function collectProblems(form) {
    const problems = [];
    validatable(form).forEach(el => {
      if (el.dataset.money !== undefined) moneyProblem(el);
      if (el.checkValidity()) { clearProblem(el); return; }
      problems.push({ el, label: labelOf(el), msg: messageFor(el, labelOf(el)) });
    });
    return problems;
  }

  function validateForm(form) {
    const problems = collectProblems(form);
    problems.forEach(({ el, msg }) => showProblem(el, msg));
    renderSummary(form, problems);
    if (problems.length) focusField(problems[0].el);
    return !problems.length;
  }

  function resetForm(form) {
    form.querySelector('.form-summary')?.remove();
    validatable(form).forEach(clearProblem);
  }

  function prepareForm(form) {
    if (form.dataset.formReady || form.dataset.validate === 'off') return;
    form.dataset.formReady = '1';
    form.noValidate = true;
    form.addEventListener('submit', event => {
      // Erst blockieren, dann anzeigen: so bleibt ein unvollständiges Formular auch dann
      // ungesendet, wenn beim Aufbereiten der Meldungen etwas schiefgeht.
      const problems = collectProblems(form);
      if (problems.length) { event.preventDefault(); event.stopPropagation(); }
      problems.forEach(({ el, msg }) => showProblem(el, msg));
      renderSummary(form, problems);
      if (problems.length) focusField(problems[0].el);
    });
    form.addEventListener('focusout', event => {
      if (event.target.form === form && event.target.dataset.money === undefined) checkField(event.target, true);
    });
    const revalidate = event => {
      if (event.target.form === form && event.target.classList.contains('is-invalid')) checkField(event.target, true);
    };
    form.addEventListener('input', revalidate);
    form.addEventListener('change', revalidate);
  }

  function prepare(root = document) {
    root.querySelectorAll('form').forEach(prepareForm);
    moneyFields(root).forEach(prepareMoney);
  }

  document.addEventListener('DOMContentLoaded', () => {
    prepare();
    // Beim Öffnen eines Dialogs mit sauberem Formular starten.
    document.addEventListener('show.bs.modal', event => {
      event.target.querySelectorAll('form').forEach(form => { prepareForm(form); resetForm(form); });
      moneyFields(event.target).forEach(prepareMoney);
    });
  });

  window.FinanceForms = { formatAmount, amountValue, prepare, prepareMoney, resetForm, validateForm };
})();
