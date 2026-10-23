/**
 * data.js — built-in step: import the sequence alignment.
 */

import { parseFasta } from '../parsers/fasta.js';
import { showError, showNotification } from '../ui/notifications.js';
import { escapeHtml, elementFromHtml, pickFile, readFileText, wireDropZone } from '../utilities.js';
import { assignDates } from './metadata.js';
import { complete, incomplete } from './step-status.js';

const PREVIEW_TAXON_LIMIT = 200;

export const dataStep = {
  id: 'data',
  title: 'Sequence data',
  icon: 'bi-file-earmark-binary',

  validate(state) {
    return state.alignment ? complete() : incomplete(['Import a sequence alignment.']);
  },

  render(container, context) {
    const state = context.getState();
    container.appendChild(elementFromHtml(`
      <div>
        <h2 class="step-heading">Sequence data</h2>
        <p class="text-body-secondary">Import an aligned set of nucleotide sequences in FASTA format.</p>
        <div class="drop-zone mb-4" id="alignment-drop-zone">
          <i class="bi bi-cloud-arrow-up display-6 d-block mb-2"></i>
          <p class="mb-2">Drop a FASTA file here, or</p>
          <button class="btn btn-primary" id="choose-alignment"><i class="bi bi-folder2-open me-1"></i>Choose file…</button>
        </div>
        <div id="alignment-summary"></div>
      </div>`));

    const loadAlignment = async file => {
      try {
        const { sequences, length } = parseFasta(await readFileText(file));
        context.update(current => {
          current.alignment = { fileName: file.name, length, dataType: 'nucleotide' };
          current.taxa = sequences.map(({ id, sequence }) => ({ id, sequence, dateString: '', date: null }));
          assignDates(current);
        });
        showNotification(`Imported ${sequences.length} sequences of length ${length}.`, 'success');
        context.rerender();
      } catch (problem) {
        showError(problem);
      }
    };

    wireDropZone(container.querySelector('#alignment-drop-zone'), loadAlignment);
    container.querySelector('#choose-alignment').addEventListener('click', async () => {
      const file = await pickFile('.fasta,.fas,.fa,.fna,.txt');
      if (file) loadAlignment(file);
    });

    if (!state.alignment) return;

    const taxonRows = state.taxa.slice(0, PREVIEW_TAXON_LIMIT)
      .map((taxon, index) => `<tr><td class="text-body-secondary">${index + 1}</td><td>${escapeHtml(taxon.id)}</td></tr>`)
      .join('');
    const remainder = state.taxa.length > PREVIEW_TAXON_LIMIT
      ? `<p class="small text-body-secondary">…and ${state.taxa.length - PREVIEW_TAXON_LIMIT} more.</p>`
      : '';

    container.querySelector('#alignment-summary').appendChild(elementFromHtml(`
      <div>
        <div class="row g-3 mb-3">
          ${summaryCard('File', escapeHtml(state.alignment.fileName))}
          ${summaryCard('Sequences', state.taxa.length)}
          ${summaryCard('Sites', state.alignment.length)}
        </div>
        <div class="table-responsive taxa-table">
          <table class="table table-sm table-hover">
            <thead><tr><th>#</th><th>Taxon</th></tr></thead>
            <tbody>${taxonRows}</tbody>
          </table>
        </div>
        ${remainder}
      </div>`));
  },
};

function summaryCard(label, value) {
  return `
    <div class="col-sm-4">
      <div class="card"><div class="card-body py-2">
        <div class="small text-body-secondary">${label}</div>
        <div class="fs-5 text-truncate">${value}</div>
      </div></div>
    </div>`;
}
