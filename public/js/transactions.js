document.addEventListener('DOMContentLoaded', () => {
  const modal = document.querySelector('#editTxModal');
  if (!modal) return;

  modal.addEventListener('show.bs.modal', event => {
    const button = event.relatedTarget;
    if (!button?.classList.contains('edit-transaction')) return;

    const data = button.dataset;
    document.querySelector('#editTxForm').action = `/transactions/${encodeURIComponent(data.id)}/update`;
    document.querySelector('#editTxTitle').textContent = `${data.type === 'income' ? 'Einnahme' : 'Ausgabe'} bearbeiten`;
    document.querySelector('#editType').value = data.type;
    document.querySelector('#editTypeDisplay').value = data.type;
    document.querySelector('#editDate').value = data.date;
    document.querySelector('#editDescription').value = data.description;
    const amount = value => window.FinanceForms ? window.FinanceForms.formatAmount(value) : value;
    document.querySelector('#editNet').value = amount(data.net);
    document.querySelector('#editTax').value = amount(data.tax);
    document.querySelector('#editScope').value = data.scope;
    document.querySelector('#editStatus').value = data.status;
    const account = document.querySelector('#editAccount');
    const category = document.querySelector('#editCategory');
    [account, category].forEach(select => select.querySelectorAll('[data-current-archived]').forEach(option => option.remove()));
    if (data.account && !account.querySelector(`option[value="${CSS.escape(data.account)}"]`)) account.add(new Option(`${data.accountName} (archiviert)`, data.account, true, true)).dataset.currentArchived = 'true';
    if (data.category && !category.querySelector(`option[value="${CSS.escape(data.category)}"]`)) category.add(new Option(`${data.categoryName} (archiviert)`, data.category, true, true)).dataset.currentArchived = 'true';
    account.value = data.account || account.dataset.mainAccount || '';
    category.value = data.category || '';
    document.querySelector('#editTaxRelevant').checked = data.taxRelevant === 'true';
  });
});
