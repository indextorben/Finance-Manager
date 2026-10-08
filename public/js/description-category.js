/* Beschreibung übernimmt die Kategorie: wird eine bereits genutzte Beschreibung
   eingetragen, schlägt das Formular die Kategorie der letzten Buchung vor.
   Eine selbst gewählte Kategorie bleibt dabei unangetastet. */
(() => {
  'use strict';

  const inputs = root => root.querySelectorAll('input[list="descriptionSuggestions"]');

  function categoryFor(value) {
    const name = value.trim().toLowerCase();
    if (!name) return '';
    const option = [...document.querySelectorAll('#descriptionSuggestions option')]
      .find(o => o.value.trim().toLowerCase() === name);
    return option?.dataset.category || '';
  }

  function apply(input) {
    const select = input.form?.querySelector('select[data-category-select]');
    // Nur vorbelegen, solange keine Kategorie gewählt ist oder der Vorschlag noch steht.
    if (!select || (select.value !== '' && select.dataset.suggested !== select.value)) return;
    const id = categoryFor(input.value);
    const known = id && select.querySelector(`option[value="${CSS.escape(id)}"]`);
    select.value = known ? id : '';
    select.dataset.suggested = select.value;
    select.dispatchEvent(new Event('change', {bubbles: true}));
  }

  document.addEventListener('DOMContentLoaded', () => {
    const watch = input => {
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
  });
})();
