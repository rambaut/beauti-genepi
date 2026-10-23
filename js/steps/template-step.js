/**
 * template-step.js — a wizard step defined entirely by a template's
 * annotations: a title, an optional description and a list of controls.
 */

import { evaluateExpression } from '../template/expressions.js';
import { createControl, validateControlValue } from '../ui/controls.js';
import { escapeHtml, elementFromHtml } from '../utilities.js';
import { complete, error } from './step-status.js';

function isControlVisible(control, values) {
  if (!control.visibleIf) return true;
  try {
    return evaluateExpression(control.visibleIf, values);
  } catch (problem) {
    console.warn(`visibleIf on "${control.id}":`, problem);
    return true;
  }
}

/** Build a wizard step from a template step annotation. */
export function createTemplateStep(stepDefinition) {
  const controls = stepDefinition.controls ?? [];

  return {
    id: `template:${stepDefinition.id}`,
    title: stepDefinition.title,
    icon: stepDefinition.icon ? `bi-${stepDefinition.icon}` : 'bi-sliders',

    validate(state) {
      const messages = controls
        .filter(control => isControlVisible(control, state.values))
        .map(control => validateControlValue(control, state.values[control.id]))
        .filter(Boolean);
      return messages.length ? error(messages) : complete();
    },

    render(container, context) {
      const state = context.getState();
      container.appendChild(elementFromHtml(`
        <div>
          <h2 class="step-heading">${escapeHtml(stepDefinition.title)}</h2>
          ${stepDefinition.description ? `<p class="text-body-secondary">${escapeHtml(stepDefinition.description)}</p>` : ''}
          <form class="template-controls" novalidate></form>
        </div>`));
      const form = container.querySelector('form');
      form.addEventListener('submit', event => event.preventDefault());

      const updateVisibility = () => {
        const values = context.getState().values;
        for (const control of controls) {
          const row = form.querySelector(`[data-control-id="${CSS.escape(control.id)}"]`);
          row.hidden = !isControlVisible(control, values);
        }
      };

      for (const control of controls) {
        form.appendChild(createControl(control, state.values[control.id], value => {
          context.update(current => { current.values[control.id] = value; });
          updateVisibility();
        }));
      }
      updateVisibility();
    },
  };
}
