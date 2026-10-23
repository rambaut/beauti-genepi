/**
 * metadata.js — built-in step: assign sampling dates to taxa, either parsed
 * from the taxon names or looked up in an imported CSV/TSV table.
 */

import { formatDecimalYear, fieldFromName, parseDate } from '../parsers/dates.js';
import { parseDelimited } from '../parsers/delimited.js';
import { parseTemplate } from '../template/loader.js';
import { showError, showNotification } from '../ui/notifications.js';
import { escapeHtml, elementFromHtml, pickFile, readFileText } from '../utilities.js';
import { complete, error, incomplete, warning } from './step-status.js';

const PREVIEW_TAXON_LIMIT = 500;

/** Recompute every taxon's date from the current date options. */
export function assignDates(state) {
  const options = state.dateOptions;
  let lookupTable = null;
  if (options.source === 'table' && options.table) {
    lookupTable = new Map(options.table.rows.map(row => [row[options.taxonColumn], row[options.dateColumn]]));
  }
  for (const taxon of state.taxa) {
    if (options.source === 'names') {
      // The field is shown to users 1-based; negative values count from the end.
      const fieldIndex = options.field > 0 ? options.field - 1 : options.field;
      taxon.dateString = options.delimiter ? fieldFromName(taxon.id, options.delimiter, fieldIndex) : '';
    } else {
      taxon.dateString = lookupTable?.get(taxon.id) ?? '';
    }
    taxon.date = parseDate(taxon.dateString)?.decimal ?? null;
  }
}

function templateRequiresDates(state) {
  if (!state.templateText) return false;
  try {
    return parseTemplate(state.templateText).meta.requires.includes('dates');
  } catch {
    return false;
  }
}

function guessColumn(headers, pattern, fallback) {
  const index = headers.findIndex(header => pattern.test(header));
  return index >= 0 ? index : fallback;
}

export const metadataStep = {
  id: 'metadata',
  title: 'Sampling dates',
  icon: 'bi-calendar-event',

  validate(state) {
    if (state.taxa.length === 0) return incomplete(['Import sequences first.']);
    const undated = state.taxa.filter(taxon => taxon.date === null).length;
    if (undated === 0) return complete();
    const message = `${undated} of ${state.taxa.length} taxa have no valid sampling date.`;
    return templateRequiresDates(state) ? error([message]) : warning([message]);
  },

  render(container, context) {
    const state = context.getState();
    const options = state.dateOptions;

    container.appendChild(elementFromHtml(`
      <div>
        <h2 class="step-heading">Sampling dates</h2>
        <p class="text-body-secondary">
          Dates may be full (2020-03-15), month (2020-03), year (2020) or decimal (2020.204).
          Partial dates are placed at the middle of their month or year.
        </p>
        <div class="btn-group mb-3" role="group">
          <input type="radio" class="btn-check" name="date-source" id="date-source-names" value="names" ${options.source === 'names' ? 'checked' : ''}>
          <label class="btn btn-outline-primary" for="date-source-names"><i class="bi bi-input-cursor-text me-1"></i>From taxon names</label>
          <input type="radio" class="btn-check" name="date-source" id="date-source-table" value="table" ${options.source === 'table' ? 'checked' : ''}>
          <label class="btn btn-outline-primary" for="date-source-table"><i class="bi bi-table me-1"></i>From metadata table</label>
        </div>
        <div id="date-source-options" class="mb-3"></div>
        <div id="taxa-dates"></div>
      </div>`));

    const applyAndRefresh = mutate => {
      context.update(current => {
        mutate(current.dateOptions);
        assignDates(current);
      });
      renderDateTable(container.querySelector('#taxa-dates'), context.getState());
    };

    for (const radio of container.querySelectorAll('input[name="date-source"]')) {
      radio.addEventListener('change', () => {
        applyAndRefresh(dateOptions => { dateOptions.source = radio.value; });
        renderSourceOptions();
      });
    }

    const renderSourceOptions = () => {
      const optionsContainer = container.querySelector('#date-source-options');
      const current = context.getState().dateOptions;
      optionsContainer.innerHTML = '';

      if (current.source === 'names') {
        optionsContainer.appendChild(elementFromHtml(`
          <div class="row g-3 date-name-options">
            <div class="col-sm-4 col-lg-3">
              <label class="form-label" for="date-delimiter">Field delimiter</label>
              <input class="form-control" id="date-delimiter" value="${escapeHtml(current.delimiter)}">
            </div>
            <div class="col-sm-4 col-lg-3">
              <label class="form-label" for="date-field">Field</label>
              <input class="form-control" type="number" step="1" id="date-field" value="${current.field}">
              <div class="form-text">1 = first, −1 = last.</div>
            </div>
          </div>`));
        optionsContainer.querySelector('#date-delimiter').addEventListener('input', event => {
          applyAndRefresh(dateOptions => { dateOptions.delimiter = event.target.value; });
        });
        optionsContainer.querySelector('#date-field').addEventListener('input', event => {
          const field = Number(event.target.value);
          if (Number.isInteger(field) && field !== 0) applyAndRefresh(dateOptions => { dateOptions.field = field; });
        });
        return;
      }

      const table = current.table;
      const columnOptions = selected => (table?.headers ?? [])
        .map((header, index) => `<option value="${index}" ${index === selected ? 'selected' : ''}>${escapeHtml(header)}</option>`)
        .join('');
      optionsContainer.appendChild(elementFromHtml(`
        <div class="row g-3 align-items-end">
          <div class="col-sm-auto">
            <button class="btn btn-outline-primary" id="import-metadata"><i class="bi bi-folder2-open me-1"></i>Import CSV/TSV…</button>
            ${table ? `<div class="form-text">${escapeHtml(table.fileName)} — ${table.rows.length} rows</div>` : ''}
          </div>
          ${table ? `
          <div class="col-sm-4 col-lg-3">
            <label class="form-label" for="taxon-column">Taxon name column</label>
            <select class="form-select" id="taxon-column">${columnOptions(current.taxonColumn)}</select>
          </div>
          <div class="col-sm-4 col-lg-3">
            <label class="form-label" for="date-column">Date column</label>
            <select class="form-select" id="date-column">${columnOptions(current.dateColumn)}</select>
          </div>` : ''}
        </div>`));

      optionsContainer.querySelector('#import-metadata').addEventListener('click', async () => {
        const file = await pickFile('.csv,.tsv,.txt');
        if (!file) return;
        try {
          const { headers, rows } = parseDelimited(await readFileText(file));
          applyAndRefresh(dateOptions => {
            dateOptions.table = { fileName: file.name, headers, rows };
            dateOptions.taxonColumn = guessColumn(headers, /name|taxon|strain|^id$/i, 0);
            dateOptions.dateColumn = guessColumn(headers, /date/i, Math.min(1, headers.length - 1));
          });
          showNotification(`Imported ${rows.length} metadata rows.`, 'success');
          renderSourceOptions();
        } catch (problem) {
          showError(problem);
        }
      });
      optionsContainer.querySelector('#taxon-column')?.addEventListener('change', event => {
        applyAndRefresh(dateOptions => { dateOptions.taxonColumn = Number(event.target.value); });
      });
      optionsContainer.querySelector('#date-column')?.addEventListener('change', event => {
        applyAndRefresh(dateOptions => { dateOptions.dateColumn = Number(event.target.value); });
      });
    };

    renderSourceOptions();
    renderDateTable(container.querySelector('#taxa-dates'), state);
  },
};

function renderDateTable(container, state) {
  if (state.taxa.length === 0) {
    container.innerHTML = '<div class="alert alert-secondary">Import sequences in the previous step to assign dates.</div>';
    return;
  }
  const dated = state.taxa.filter(taxon => taxon.date !== null).length;
  const rows = state.taxa.slice(0, PREVIEW_TAXON_LIMIT).map(taxon => {
    const isValid = taxon.date !== null;
    return `
      <tr class="${isValid ? '' : 'table-warning'}">
        <td>${escapeHtml(taxon.id)}</td>
        <td>${escapeHtml(taxon.dateString)}</td>
        <td class="font-monospace">${formatDecimalYear(taxon.date)}</td>
        <td>${isValid ? '<i class="bi bi-check-lg text-success"></i>' : '<i class="bi bi-question-lg text-warning"></i>'}</td>
      </tr>`;
  }).join('');
  const remainder = state.taxa.length > PREVIEW_TAXON_LIMIT
    ? `<p class="small text-body-secondary">…and ${state.taxa.length - PREVIEW_TAXON_LIMIT} more.</p>`
    : '';
  container.innerHTML = `
    <p class="mb-2"><strong>${dated}</strong> of ${state.taxa.length} taxa dated.</p>
    <div class="table-responsive taxa-table">
      <table class="table table-sm table-hover">
        <thead><tr><th>Taxon</th><th>Date</th><th>Decimal year</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${remainder}`;
}
