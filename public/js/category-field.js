/* Kategorie-Feld: über „+ Neue Kategorie anlegen …“ lässt sich die Kategorie direkt
   im Buchungsformular erfassen – sie wird beim Speichern mit angelegt. */
(() => {
  'use strict';

  const NEW = '__new';

  function sync(select, focus) {
    const field = select.closest('[data-category-field]');
    const box = field?.querySelector('[data-category-new]');
    const input = box?.querySelector('input[name="new_category"]');
    if (!box || !input) return;
    const creating = select.value === NEW;
    box.classList.toggle('d-none', !creating);
    input.disabled = !creating;
    input.required = creating;
    if (!creating) input.value = '';
    else if (focus) input.focus();
  }

  const fields = root => root.querySelectorAll('select[data-category-select]');

  document.addEventListener('DOMContentLoaded', () => {
    fields(document).forEach(select => sync(select, false));
    document.addEventListener('change', event => {
      if (event.target.matches?.('select[data-category-select]')) sync(event.target, true);
    });
    // Nach dem Vorbelegen eines Dialogs den Zustand des Feldes nachziehen.
    document.addEventListener('show.bs.modal', event => fields(event.target).forEach(select => sync(select, false)));
  });
})();
