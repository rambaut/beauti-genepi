/**
 * controls.js — build Bootstrap form widgets from template control annotations.
 *
 * Each annotation is { id, type, label, help?, default?, ... } where the type is
 * one of template/loader.js CONTROL_TYPES. Type-specific fields:
 *   select           options: [string | { value, label }]
 *   number, integer  min?, max?, step?
 *   text             placeholder?, pattern?
 * Any control may have "visibleIf" (an expression) and "required" (boolean).
 */

import { optionLabel, optionValue } from '../template/loader.js';
import { escapeHtml, elementFromHtml } from '../utilities.js';

let controlCounter = 0;

/**
 * Create the form row for a control.
 * @param {object} control           control annotation
 * @param {*} value                  current value
 * @param {(value: *) => void} onChange
 * @returns {HTMLElement}
 */
export function createControl(control, value, onChange) {
  const inputId = `control-${control.id}-${++controlCounter}`;
  const label = escapeHtml(control.label ?? control.id);
  const help = control.help
    ? `<div class="form-text">${escapeHtml(control.help)}</div>`
    : '';

  let row;
  if (control.type === 'checkbox') {
    row = elementFromHtml(`
      <div class="mb-3 control-row">
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" role="switch" id="${inputId}">
          <label class="form-check-label" for="${inputId}">${label}</label>
        </div>
        ${help}
      </div>`);
    const input = row.querySelector('input');
    input.checked = Boolean(value);
    input.addEventListener('change', () => onChange(input.checked));
  } else if (control.type === 'select') {
    const options = control.options.map(option =>
      `<option value="${escapeHtml(optionValue(option))}">${escapeHtml(optionLabel(option))}</option>`
    ).join('');
    row = elementFromHtml(`
      <div class="mb-3 control-row">
        <label class="form-label" for="${inputId}">${label}</label>
        <select class="form-select" id="${inputId}">${options}</select>
        ${help}
      </div>`);
    const select = row.querySelector('select');
    select.value = String(value);
    select.addEventListener('change', () => onChange(select.value));
  } else {
    const isNumeric = control.type === 'number' || control.type === 'integer';
    const attributes = [
      `type="${isNumeric ? 'number' : 'text'}"`,
      control.min !== undefined ? `min="${control.min}"` : '',
      control.max !== undefined ? `max="${control.max}"` : '',
      isNumeric ? `step="${control.step ?? (control.type === 'integer' ? 1 : 'any')}"` : '',
      control.placeholder ? `placeholder="${escapeHtml(control.placeholder)}"` : '',
    ].join(' ');
    row = elementFromHtml(`
      <div class="mb-3 control-row">
        <label class="form-label" for="${inputId}">${label}</label>
        <input class="form-control" id="${inputId}" ${attributes}>
        <div class="invalid-feedback"></div>
        ${help}
      </div>`);
    const input = row.querySelector('input');
    input.value = value ?? '';
    input.addEventListener('input', () => {
      const newValue = isNumeric && input.value !== '' ? Number(input.value) : input.value;
      onChange(newValue);
      showValidity(row, control, newValue);
    });
    showValidity(row, control, value);
  }

  row.dataset.controlId = control.id;
  return row;
}

function showValidity(row, control, value) {
  const input = row.querySelector('input');
  const message = validateControlValue(control, value);
  input.classList.toggle('is-invalid', Boolean(message));
  const feedback = row.querySelector('.invalid-feedback');
  if (feedback) feedback.textContent = message ?? '';
}

/** Return an error message for an invalid value, or null if it is valid. */
export function validateControlValue(control, value) {
  const isEmpty = value === '' || value === null || value === undefined;
  if (isEmpty) {
    const required = control.required ?? (control.type === 'number' || control.type === 'integer');
    return required ? `${control.label ?? control.id} is required.` : null;
  }
  if (control.type === 'number' || control.type === 'integer') {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'Must be a number.';
    if (control.type === 'integer' && !Number.isInteger(value)) return 'Must be a whole number.';
    if (control.min !== undefined && value < control.min) return `Must be at least ${control.min}.`;
    if (control.max !== undefined && value > control.max) return `Must be at most ${control.max}.`;
  }
  if (control.type === 'text' && control.pattern && !new RegExp(`^(?:${control.pattern})$`).test(value)) {
    return control.patternMessage ?? 'Invalid format.';
  }
  return null;
}
