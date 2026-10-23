/**
 * step-status.js — validation results shared by all wizard steps.
 *
 * Every step exports
 *   { id, title, icon, render(container, context), validate(state) }
 * where validate returns { status, messages } and context is
 *   { getState, update, rerender, goToStep, steps }.
 */

export const StepStatus = Object.freeze({
  COMPLETE: 'complete',
  WARNING: 'warning',
  ERROR: 'error',
  INCOMPLETE: 'incomplete',
});

export function complete(messages = []) {
  return { status: StepStatus.COMPLETE, messages };
}

export function warning(messages) {
  return { status: StepStatus.WARNING, messages };
}

export function error(messages) {
  return { status: StepStatus.ERROR, messages };
}

export function incomplete(messages = []) {
  return { status: StepStatus.INCOMPLETE, messages };
}
