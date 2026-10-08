/* Bearbeiten-Dialog der Standardbuchungen mit den Werten der angeklickten Karte füllen. */
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.querySelector('#recurringEditModal');
  if (!modal) return;

  modal.addEventListener('show.bs.modal', event => {
    const button = event.relatedTarget;
    if (!button?.classList.contains('edit-recurring')) return;

    const data = button.dataset;
    document.querySelector('#recurringEditForm').action = `/recurring/${encodeURIComponent(data.id)}/update`;
    document.querySelector('#recurringEditType').value = data.type;
    document.querySelector('#recurringEditDescription').value = data.description;
    document.querySelector('#recurringEditFrequency').value = data.frequency;
    document.querySelector('#recurringEditDate').value = data.date;
    document.querySelector('#recurringEditTemplate').checked = data.template === 'true';
    // Der gespeicherte Betrag gilt als gesetzt und wird von einem Beschreibungsvorschlag nicht ersetzt.
    const amount = document.querySelector('#recurringEditAmount');
    amount.value = window.FinanceForms ? window.FinanceForms.formatAmount(data.amount) : data.amount;
    amount.dataset.userAmount = '1';

    const account = document.querySelector('#recurringEditAccount');
    const category = document.querySelector('#recurringEditCategory');
    // Archivierte Zuordnungen bleiben sichtbar, damit sie beim Speichern nicht verloren gehen.
    [account, category].forEach(select => select.querySelectorAll('[data-current-archived]').forEach(option => option.remove()));
    if (data.account && !account.querySelector(`option[value="${CSS.escape(data.account)}"]`)) account.add(new Option(`${data.accountName} (archiviert)`, data.account, true, true)).dataset.currentArchived = 'true';
    if (data.category && !category.querySelector(`option[value="${CSS.escape(data.category)}"]`)) category.add(new Option(`${data.categoryName} (archiviert)`, data.category, true, true)).dataset.currentArchived = 'true';
    account.value = data.account || '';
    category.value = data.category || '';
    category.dispatchEvent(new Event('change', {bubbles: true}));
  });
});
