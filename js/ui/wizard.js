/**
 * wizard.js — the step sidebar, content pane and Back/Next navigation.
 *
 * The step list is the built-in Template, Data and Metadata steps, then the
 * steps declared by the active template, then the built-in Generate step.
 */

import { getState, subscribe, update } from '../state.js';
import { dataStep } from '../steps/data.js';
import { generateStep } from '../steps/generate.js';
import { metadataStep } from '../steps/metadata.js';
import { StepStatus } from '../steps/step-status.js';
import { createTemplateStep } from '../steps/template-step.js';
import { templateSelectionStep } from '../steps/template-selection.js';
import { parseTemplate } from '../template/loader.js';
import { escapeHtml } from '../utilities.js';

const STATUS_ICONS = {
  [StepStatus.COMPLETE]: 'bi-check-circle-fill text-success',
  [StepStatus.WARNING]: 'bi-exclamation-triangle-fill text-warning',
  [StepStatus.ERROR]: 'bi-x-circle-fill text-danger',
  [StepStatus.INCOMPLETE]: 'bi-circle text-body-tertiary',
};

const templateStepCache = new Map();

function templateSteps(state) {
  if (!state.templateText) return [];
  if (!templateStepCache.has(state.templateText)) {
    let steps = [];
    try {
      steps = parseTemplate(state.templateText).steps.map(createTemplateStep);
    } catch (problem) {
      console.error('Active template is invalid:', problem);
    }
    templateStepCache.clear();
    templateStepCache.set(state.templateText, steps);
  }
  return templateStepCache.get(state.templateText);
}

export function allSteps(state = getState()) {
  return [templateSelectionStep, dataStep, metadataStep, ...templateSteps(state), generateStep];
}

/**
 * @param {object} elements
 * @param {HTMLElement} elements.sidebar
 * @param {HTMLElement} elements.content
 * @param {HTMLButtonElement} elements.backButton
 * @param {HTMLButtonElement} elements.nextButton
 * @param {HTMLElement} elements.positionLabel
 */
export function createWizard({ sidebar, content, backButton, nextButton, positionLabel }) {
  const context = {
    getState,
    update,
    rerender: () => { renderContent(); renderNavigation(); },
    goToStep,
    steps: () => allSteps(),
  };

  function currentIndex() {
    const steps = allSteps();
    const index = steps.findIndex(step => step.id === getState().currentStep);
    return index >= 0 ? index : 0;
  }

  function goToStep(stepId) {
    update(state => { state.currentStep = stepId; });
    renderContent();
    renderNavigation();
  }

  function renderNavigation() {
    const state = getState();
    const steps = allSteps(state);
    const activeIndex = currentIndex();

    sidebar.innerHTML = steps.map((step, index) => {
      const { status, messages } = step.validate(state);
      const tooltip = messages.length ? ` title="${escapeHtml(messages.join(' '))}"` : '';
      return `
        <li class="list-group-item list-group-item-action step-item ${index === activeIndex ? 'active' : ''}"
            data-step-id="${escapeHtml(step.id)}" role="button" tabindex="0"${tooltip}>
          <span class="step-number">${index + 1}</span>
          <i class="bi ${step.icon} step-icon"></i>
          <span class="step-title">${escapeHtml(step.title)}</span>
          <i class="bi ${STATUS_ICONS[status]} step-status"></i>
        </li>`;
    }).join('');

    for (const item of sidebar.querySelectorAll('.step-item')) {
      const open = () => goToStep(item.dataset.stepId);
      item.addEventListener('click', open);
      item.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
      });
    }

    backButton.disabled = activeIndex === 0;
    nextButton.disabled = activeIndex === steps.length - 1;
    positionLabel.textContent = `Step ${activeIndex + 1} of ${steps.length}`;
  }

  function renderContent() {
    const step = allSteps()[currentIndex()];
    content.innerHTML = '';
    content.scrollTop = 0;
    step.render(content, context);
  }

  backButton.addEventListener('click', () => {
    const index = currentIndex();
    if (index > 0) goToStep(allSteps()[index - 1].id);
  });
  nextButton.addEventListener('click', () => {
    const steps = allSteps();
    const index = currentIndex();
    if (index < steps.length - 1) goToStep(steps[index + 1].id);
  });

  // Statuses depend on the whole state, so refresh the sidebar on every change.
  subscribe(renderNavigation);

  return {
    goToStep,
    refresh: context.rerender,
  };
}
