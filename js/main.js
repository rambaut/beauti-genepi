/**
 * main.js — BEAUti|GenEpi entry point: wires the navbar, theme and wizard.
 */

import {
  getState, parseSavedState, replaceState, resetState, restoreAutosave, serialiseState, subscribe, update,
} from './state.js';
import { outputFileStem } from './steps/generate.js';
import { activateTemplate } from './steps/template-selection.js';
import { fetchTemplate } from './template/loader.js';
import { showError, showNotification } from './ui/notifications.js';
import { createWizard } from './ui/wizard.js';
import { downloadBlob, pickFile, readFileText } from './utilities.js';

const THEME_STORAGE_KEY = 'beauti-genepi.theme';

function preferredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) return stored;
  } catch { /* storage unavailable */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.bsTheme = theme;
  const icon = document.querySelector('#toggle-theme i');
  icon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars';
}

function setupThemeToggle() {
  applyTheme(preferredTheme());
  document.getElementById('toggle-theme').addEventListener('click', () => {
    const next = document.documentElement.dataset.bsTheme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* storage unavailable */ }
  });
}

function updateTemplateLabel() {
  const template = getState().template;
  document.getElementById('template-name-label').textContent = template
    ? `${template.name}${template.version ? ` v${template.version}` : ''}`
    : '';
}

/** Load a template named by ?template=<url>, so hosted templates can be linked to directly. */
async function loadTemplateFromQuery(wizard) {
  const url = new URLSearchParams(window.location.search).get('template');
  if (!url) return;
  try {
    const parsedTemplate = activateTemplate(await fetchTemplate(url), { type: 'url', url }, update);
    showNotification(`Loaded template “${parsedTemplate.meta.name}”.`, 'success');
    wizard.goToStep('data');
  } catch (problem) {
    showError(problem);
  }
}

function main() {
  setupThemeToggle();
  restoreAutosave();

  const wizard = createWizard({
    sidebar: document.getElementById('step-list'),
    content: document.getElementById('step-content'),
    backButton: document.getElementById('step-back'),
    nextButton: document.getElementById('step-next'),
    positionLabel: document.getElementById('step-position'),
  });

  subscribe(updateTemplateLabel);

  document.getElementById('new-analysis').addEventListener('click', () => {
    if (!confirm('Start a new analysis? Unsaved changes will be lost.')) return;
    resetState();
    wizard.refresh();
  });

  document.getElementById('open-analysis').addEventListener('click', async () => {
    const file = await pickFile('.json');
    if (!file) return;
    try {
      replaceState(parseSavedState(await readFileText(file)));
      wizard.refresh();
      showNotification(`Opened ${file.name}.`, 'success');
    } catch (problem) {
      showError(problem);
    }
  });

  document.getElementById('save-analysis').addEventListener('click', () => {
    downloadBlob(serialiseState(), 'application/json', `${outputFileStem(getState())}.beauti-genepi.json`);
  });

  document.getElementById('generate-xml').addEventListener('click', () => wizard.goToStep('generate'));

  wizard.refresh();
  updateTemplateLabel();
  loadTemplateFromQuery(wizard);
}

main();
