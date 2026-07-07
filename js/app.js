/**
 * BoardCost UI layer.
 *
 * This file is deliberately thin: it reads the form, hands a spec object to
 * the pure calculation engine (js/calculator.js), and renders the result.
 * All business logic lives in the engine so it stays unit-testable.
 */

(function boardCostApp() {
  const BC = window.BoardCost;

  const el = (id) => document.getElementById(id);
  const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

  let lastQuote = null;

  function readSpec() {
    return {
      displayType: el('display-type').value,
      widthMm: Number(el('width').value),
      heightMm: Number(el('height').value),
      depthMm: Number(el('depth').value),
      boardGrade: el('board-grade').value,
      printProcess: el('print-process').value,
      lamination: el('lamination').value,
      dieCut: el('die-cut').checked,
      includeVat: el('include-vat').checked,
      quantity: Number(el('quantity').value),
    };
  }

  function showError(message) {
    const box = el('form-error');
    box.textContent = message;
    box.hidden = false;
  }

  function clearError() {
    const box = el('form-error');
    box.textContent = '';
    box.hidden = true;
  }

  function renderQuote(quote) {
    el('q-area').textContent = `${quote.areaM2.toFixed(2)} m²`;
    el('q-materials').textContent = gbp.format(quote.breakdown.materials);
    el('q-printing').textContent = gbp.format(quote.breakdown.printing);
    el('q-finishing').textContent = gbp.format(quote.breakdown.finishing);
    el('q-assembly').textContent = gbp.format(quote.breakdown.assembly);
    el('q-production').textContent = gbp.format(quote.productionCost);
    el('q-margin').textContent = gbp.format(quote.margin);
    el('q-discount-rate').textContent = `${(quote.discountRate * 100).toFixed(0)}%`;
    el('q-discount').textContent = quote.discount > 0 ? `−${gbp.format(quote.discount)}` : gbp.format(0);
    el('q-net').textContent = gbp.format(quote.netTotal);
    el('q-vat').textContent = gbp.format(quote.vat);
    el('q-grand').textContent = gbp.format(quote.grandTotal);
    el('q-unit').textContent = `${gbp.format(quote.unitPrice)} / unit`;

    el('quote-empty').hidden = true;
    el('quote-result').hidden = false;
  }

  function renderPriceBreaks(spec) {
    const rows = BC.calculatePriceBreaks(spec);
    const body = el('breaks-body');
    body.innerHTML = '';
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      if (row.quantity === spec.quantity) tr.classList.add('current');
      const qty = document.createElement('td');
      qty.textContent = row.quantity.toLocaleString('en-GB');
      const disc = document.createElement('td');
      disc.textContent = `${(row.discountRate * 100).toFixed(0)}%`;
      const unit = document.createElement('td');
      unit.textContent = gbp.format(row.unitPrice);
      tr.append(qty, disc, unit);
      body.appendChild(tr);
    });
  }

  function onCalculate() {
    clearError();
    try {
      const spec = readSpec();
      lastQuote = BC.calculateQuote(spec);
      renderQuote(lastQuote);
      renderPriceBreaks(spec);
    } catch (err) {
      showError(err.message);
    }
  }

  function onExportCsv() {
    if (!lastQuote) return;
    const csv = BC.buildCsv(lastQuote);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `boardcost-quote-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  el('calculate').addEventListener('click', onCalculate);
  el('export-csv').addEventListener('click', onExportCsv);

  // Recalculate on Enter anywhere in the form.
  document.querySelector('.spec-panel').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onCalculate();
    }
  });
}());
