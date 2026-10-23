/**
 * template-selection.js — built-in first step: choose the analysis template
 * from the built-in list, a local file, or a URL (hosted templates).
 */

import { defaultValues, fetchBuiltInTemplates, fetchTemplate, parseTemplate } from '../template/loader.js';
import { showError, showNotification } from '../ui/notifications.js';
import { escapeHtml, elementFromHtml, pickFile, readFileText } from '../utilities.js';
import { complete, incomplete } from './step-status.js';

/**
 * Parse template text and make it the active template, keeping any existing
 * control values whose ids the new template also defines.
 */
export function activateTemplate(text, source, update) {
  const parsedTemplate = parseTemplate(text);
  update(state => {
    const values = defaultValues(parsedTemplate);
    for (const id of Object.keys(values)) {
      if (id in state.values) values[id] = state.values[id];
    }
    state.template = {
      name: parsedTemplate.meta.name,
      version: parsedTemplate.meta.version,
      source,
    };
    state.templateText = text;
    state.values = values;
  });
  return parsedTemplate;
}

export const templateSelectionStep = {
  id: 'template',
  title: 'Template',
  icon: 'bi-journal-code',

  validate(state) {
    return state.templateText ? complete() : incomplete(['Choose an analysis template.']);
  },

  render(container, context) {
    const state = context.getState();
    container.appendChild(elementFromHtml(`
      <div>
        <h2 class="step-heading">Analysis template</h2>
        <p class="text-body-secondary">
          A template defines a complete BEAST analysis and the options you can adjust.
          Choose a built-in template, or load one from a file or web address.
        </p>
        <div class="row g-3 mb-4" id="built-in-templates">
          <div class="col-12 text-body-secondary"><span class="spinner-border spinner-border-sm me-2"></span>Loading templates…</div>
        </div>
        <div class="d-flex flex-wrap gap-2 align-items-start">
          <button class="btn btn-outline-primary" id="open-template-file">
            <i class="bi bi-folder2-open me-1"></i>Open template file…
          </button>
          <form class="input-group template-url-form" id="template-url-form">
            <input type="url" class="form-control" placeholder="https://…/template.xml" id="template-url" required>
            <button class="btn btn-outline-primary" type="submit"><i class="bi bi-cloud-download me-1"></i>Load from URL</button>
          </form>
        </div>
      </div>`));

    const useTemplate = (text, source) => {
      try {
        const parsedTemplate = activateTemplate(text, source, context.update);
        showNotification(`Loaded template “${parsedTemplate.meta.name}”.`, 'success');
        context.rerender();
      } catch (problem) {
        showError(problem);
      }
    };

    container.querySelector('#open-template-file').addEventListener('click', async () => {
      const file = await pickFile('.xml');
      if (file) useTemplate(await readFileText(file), { type: 'file', name: file.name });
    });

    container.querySelector('#template-url-form').addEventListener('submit', async event => {
      event.preventDefault();
      const url = container.querySelector('#template-url').value.trim();
      try {
        useTemplate(await fetchTemplate(url), { type: 'url', url });
      } catch (problem) {
        showError(problem);
      }
    });

    const grid = container.querySelector('#built-in-templates');
    fetchBuiltInTemplates().then(templates => {
      grid.innerHTML = '';
      for (const entry of templates) {
        const isActive = state.template?.source?.type === 'built-in' && state.template.source.file === entry.file;
        const card = elementFromHtml(`
          <div class="col-md-6 col-xl-4">
            <div class="card h-100 template-card ${isActive ? 'border-primary active' : ''}">
              <div class="card-body">
                <h3 class="card-title h6">${escapeHtml(entry.name)}
                  ${isActive ? '<span class="badge text-bg-primary ms-1">Selected</span>' : ''}</h3>
                <p class="card-text small text-body-secondary">${escapeHtml(entry.description ?? '')}</p>
              </div>
              <div class="card-footer bg-transparent border-0 pt-0">
                <button class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-primary'}">Use this template</button>
              </div>
            </div>
          </div>`);
        card.querySelector('button').addEventListener('click', async () => {
          try {
            useTemplate(await fetchTemplate(`templates/${entry.file}`), { type: 'built-in', file: entry.file });
          } catch (problem) {
            showError(problem);
          }
        });
        grid.appendChild(card);
      }
      if (state.templateText && state.template?.source?.type !== 'built-in') {
        grid.insertAdjacentHTML('afterbegin', `
          <div class="col-12"><div class="alert alert-primary mb-0">
            Current template: <strong>${escapeHtml(state.template.name)}</strong>
            ${state.template.version ? `(version ${escapeHtml(state.template.version)})` : ''}
          </div></div>`);
      }
    }).catch(problem => {
      grid.innerHTML = `<div class="col-12 text-danger">${escapeHtml(problem.message)}</div>`;
    });
  },
};
