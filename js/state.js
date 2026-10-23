/**
 * state.js — the single analysis state object.
 *
 * Everything needed to regenerate an analysis lives here: the template text,
 * the values of the template's controls, and the imported data. Steps read
 * the state with getState() and change it through update(), which notifies
 * subscribers and autosaves to localStorage.
 */

import { debounce } from './utilities.js';

const STORAGE_KEY = 'beauti-genepi.analysis';
export const ANALYSIS_FORMAT_VERSION = 1;

export function emptyState() {
  return {
    formatVersion: ANALYSIS_FORMAT_VERSION,
    template: null,        // { name, version, source } of the loaded template
    templateText: null,    // full template source, so analyses are self-contained
    values: {},            // control id → value
    alignment: null,       // { fileName, length, dataType }
    taxa: [],              // [{ id, sequence, dateString, date }]
    dateOptions: { source: 'names', delimiter: '|', field: -1 },
    currentStep: 'template',
  };
}

let state = emptyState();
const listeners = new Set();

const autosave = debounce(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Autosave failed (data may be too large for localStorage):', err);
  }
}, 500);

function notify() {
  for (const fn of listeners) fn(state);
  autosave();
}

export function getState() {
  return state;
}

/** Mutate the state in place via fn(state), then notify. */
export function update(fn) {
  fn(state);
  notify();
}

/** Replace the whole state (e.g. after opening a saved analysis). */
export function replaceState(next) {
  state = { ...emptyState(), ...next };
  notify();
}

export function resetState() {
  replaceState(emptyState());
}

/** Subscribe to state changes; returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Restore the autosaved state, if any. Returns true if restored. */
export function restoreAutosave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (saved.formatVersion !== ANALYSIS_FORMAT_VERSION) return false;
    state = { ...emptyState(), ...saved };
    return true;
  } catch {
    return false;
  }
}

/** Serialise the state for saving as an analysis file. */
export function serialiseState() {
  return JSON.stringify(state, null, 2);
}

/** Parse a saved analysis file, throwing on invalid content. */
export function parseSavedState(text) {
  const saved = JSON.parse(text);
  if (typeof saved !== 'object' || saved === null || saved.formatVersion === undefined) {
    throw new Error('Not a BEAUti|GenEpi analysis file.');
  }
  if (saved.formatVersion > ANALYSIS_FORMAT_VERSION) {
    throw new Error('This analysis was saved by a newer version of BEAUti|GenEpi.');
  }
  return saved;
}
