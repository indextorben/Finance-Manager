/* Beschreibung übernimmt Kategorie und Betrag: wird eine bereits genutzte Beschreibung
   eingetragen, schlägt das Formular die Werte der letzten Buchung vor. Eine Standardbuchung,
   die als Preisvorlage markiert ist, liefert dabei den Preis. Selbst eingetragene Werte
   bleiben unangetastet – auch Beträge, sobald sie von Hand geändert wurden. */
(() => {
  'use strict';

  const inputs = root => root.querySelectorAll('input[list="descriptionSuggestions"]');
  const amountFields = form => form ? form.querySelectorAll('input[data-suggest-amount]') : [];

  function suggestionFor(value) {
    const name = value.trim().toLowerCase();
    if (!name) return null;
    const option = [...document.querySelectorAll('#descriptionSuggestions option')]
      .find(o => o.value.trim().toLowerCase() === name);
    return option ? option.dataset : null;
  }

  function applyCategory(form, data) {
    const select = form?.querySelector('select[data-category-select]');
    // Nur vorbelegen, solange keine Kategorie gewählt ist oder der Vorschlag noch steht.
    if (!select || (select.value !== '' && select.dataset.suggested !== select.value)) return;
    const id = data?.category || '';
    const known = id && select.querySelector(`option[value="${CSS.escape(id)}"]`);
    select.value = known ? id : '';
    select.dataset.suggested = select.value;
    select.dispatchEvent(new Event('change', {bubbles: true}));
  }

  const numberOf = text => window.FinanceForms ? window.FinanceForms.amountValue(text) : NaN;
  const display = value => window.FinanceForms ? window.FinanceForms.formatAmount(value) : String(value);

  // Ein Betrag darf überschrieben werden, solange er nicht von Hand kommt: leeres Feld,
  // noch stehender Vorschlag oder die Vorbelegung 0,00.
  function fillable(field) {
    if (field.dataset.userAmount === '1') return false;
    if (!field.value.trim()) return true;
    if (field.dataset.suggested === field.value) return true;
    return numberOf(field.value) === 0;
  }

  function applyAmounts(form, data) {
    amountFields(form).forEach(field => {
      if (!fillable(field)) return;
      const raw = data ? data[field.dataset.suggestAmount] : undefined;
      const value = raw === undefined || raw === '' ? (field.dataset.suggestInitial || '') : display(raw);
      if (field.value === value) return;
      field.value = value;
      field.dataset.suggested = value;
      field.dispatchEvent(new Event('change', {bubbles: true}));
    });
  }

  function apply(input) {
    const data = suggestionFor(input.value);
    applyCategory(input.form, data);
    applyAmounts(input.form, data);
  }

  function watchAmounts(form) {
    amountFields(form).forEach(field => {
      if (field.dataset.suggestInitial === undefined) field.dataset.suggestInitial = field.value;
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const watch = input => {
      watchAmounts(input.form);
      if (input.dataset.categoryLink) return;
      input.dataset.categoryLink = 'true';
      ['input', 'change'].forEach(type => input.addEventListener(type, () => apply(input)));
    };
    inputs(document).forEach(watch);
    // Dialoge bringen ihre Felder erst beim Öffnen in den Vordergrund.
    document.addEventListener('show.bs.modal', event => inputs(event.target).forEach(watch));
    // Eine von Hand gewählte Kategorie gilt als Entscheidung des Nutzers.
    document.addEventListener('change', event => {
      const select = event.target;
      if (select.matches?.('select[data-category-select]') && event.isTrusted) delete select.dataset.suggested;
    });
    // Ebenso ein selbst eingetippter Betrag – danach wird er nicht mehr vorbelegt.
    ['input', 'change'].forEach(type => document.addEventListener(type, event => {
      const field = event.target;
      if (event.isTrusted && field.matches?.('input[data-suggest-amount]') && field.dataset.suggested !== field.value) field.dataset.userAmount = '1';
    }));
  });
})();
