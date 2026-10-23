/**
 * generate.js — built-in final step: check the analysis, preview the BEAST
 * XML and download it.
 */

import { parseTemplate } from '../template/loader.js';
import { showError, showNotification } from '../ui/notifications.js';
import { renderXml } from '../xml/render.js';
import { downloadBlob, escapeHtml, elementFromHtml } from '../utilities.js';
import { StepStatus, complete, error, incomplete } from './step-status.js';

const PREVIEW_CHARACTER_LIMIT = 200_000;

/** Base name for output files, from a "fileStem" control if the template has one. */
export function outputFileStem(state) {
  return String(state.values.fileStem || 'analysis').trim() || 'analysis';
}

/** Render the XML for the current state, throwing on template errors. */
export function generateXml(state) {
  if (!state.templateText) throw new Error('No template loaded.');
  return renderXml(parseTemplate(state.templateText), state);
}

export const generateStep = {
  id: 'generate',
  title: 'Generate XML',
  icon: 'bi-filetype-xml',

  validate(state) {
    if (!state.templateText) return incomplete(['Choose a template.']);
    if (!state.alignment) return incomplete(['Import sequence data.']);
    return complete();
  },

  render(container, context) {
    const state = context.getState();
    const otherSteps = context.steps().filter(step => step.id !== 'generate');
    const problems = otherSteps
      .map(step => ({ step, result: step.validate(state) }))
      .filter(({ result }) => result.status !== StepStatus.COMPLETE);

    container.appendChild(elementFromHtml(`
      <div>
        <h2 class="step-heading">Generate BEAST XML</h2>
        <div id="analysis-checks" class="mb-3"></div>
        <div class="d-flex flex-wrap gap-2 mb-3">
          <button class="btn btn-primary" id="download-xml"><i class="bi bi-download me-1"></i>Download XML</button>
          <button class="btn btn-outline-secondary" id="copy-xml"><i class="bi bi-clipboard me-1"></i>Copy to clipboard</button>
        </div>
        <pre class="xml-preview border rounded p-3" id="xml-preview"></pre>
      </div>`));

    const checks = container.querySelector('#analysis-checks');
    if (problems.length === 0) {
      checks.innerHTML = '<div class="alert alert-success mb-0"><i class="bi bi-check-circle me-2"></i>All steps are complete.</div>';
    } else {
      const items = problems.map(({ step, result }) => `
        <li><a href="#" data-step-id="${escapeHtml(step.id)}">${escapeHtml(step.title)}</a>:
          ${result.messages.map(escapeHtml).join(' ')}</li>`).join('');
      const isBlocking = problems.some(({ result }) =>
        result.status === StepStatus.ERROR || result.status === StepStatus.INCOMPLETE);
      checks.innerHTML = `
        <div class="alert ${isBlocking ? 'alert-danger' : 'alert-warning'} mb-0">
          <p class="mb-1">${isBlocking ? 'Some steps need attention before this analysis will run:' : 'Warnings:'}</p>
          <ul class="mb-0">${items}</ul>
        </div>`;
      for (const link of checks.querySelectorAll('[data-step-id]')) {
        link.addEventListener('click', event => {
          event.preventDefault();
          context.goToStep(link.dataset.stepId);
        });
      }
    }

    const preview = container.querySelector('#xml-preview');
    let xml = null;
    if (state.templateText && state.alignment) {
      try {
        xml = generateXml(state);
        preview.textContent = xml.length > PREVIEW_CHARACTER_LIMIT
          ? `${xml.slice(0, PREVIEW_CHARACTER_LIMIT)}\n\n… (preview truncated; the download contains the full file)`
          : xml;
      } catch (problem) {
        preview.textContent = `Template error: ${problem.message}`;
        preview.classList.add('text-danger');
      }
    } else {
      preview.textContent = 'Choose a template and import sequence data to see the XML.';
      preview.classList.add('text-body-secondary');
    }

    const downloadButton = container.querySelector('#download-xml');
    const copyButton = container.querySelector('#copy-xml');
    downloadButton.disabled = copyButton.disabled = xml === null;

    downloadButton.addEventListener('click', () => {
      downloadBlob(xml, 'application/xml', `${outputFileStem(state)}.xml`);
    });
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(xml);
        showNotification('XML copied to the clipboard.', 'success');
      } catch (problem) {
        showError(problem);
      }
    });
  },
};
