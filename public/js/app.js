document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[name=tx_date],input[name=next_date]').forEach(field => {
    if (!field.value) field.value = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
  });
});
