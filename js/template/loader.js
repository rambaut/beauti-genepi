/**
 * loader.js — load and parse BEAUti|GenEpi templates.
 *
 * PROVISIONAL FORMAT. A template is a single XML file: BEAST XML containing
 * ${placeholders} and {{#if}}/{{#each}} blocks (see xml/render.js), preceded
 * by an annotation comment holding JSON that describes the template and the
 * UI controls it needs:
 *
 *   <!--@beauti-genepi
 *   { "name": "...", "version": "...", "description": "...",
 *     "requires": ["alignment", "dates"],
 *     "steps": [ { "id": "...", "title": "...", "icon": "...",
 *                  "controls": [ { "id", "type", "label", "default", ... } ] } ] }
 *   -->
 *
 * Only this module knows how annotations are embedded, so the format can be
 * changed here without touching the UI.
 */

export const CONTROL_TYPES = ['select', 'number', 'integer', 'checkbox', 'text'];

const ANNOTATION_PATTERN = /<!--@beauti-genepi\s*([\s\S]*?)-->/;

const parsedTemplateCache = new Map();

/**
 * Parse template text into { meta, steps, controls, body }.
 * Results are cached by text. Throws an Error describing any problem.
 */
export function parseTemplate(text) {
  if (parsedTemplateCache.has(text)) return parsedTemplateCache.get(text);

  const annotationMatch = text.match(ANNOTATION_PATTERN);
  if (!annotationMatch) throw new Error('No <!--@beauti-genepi ... --> annotation block found.');

  let annotation;
  try {
    annotation = JSON.parse(annotationMatch[1]);
  } catch (error) {
    throw new Error(`Template annotation is not valid JSON: ${error.message}`);
  }

  validateAnnotation(annotation);

  const body = text.replace(ANNOTATION_PATTERN, '').replace(/^\s*\n/, '');
  const steps = annotation.steps ?? [];
  const controls = steps.flatMap(step => step.controls ?? []);

  const parsedTemplate = {
    meta: {
      name: annotation.name,
      version: annotation.version ?? '',
      description: annotation.description ?? '',
      author: annotation.author ?? '',
      requires: annotation.requires ?? ['alignment'],
    },
    steps,
    controls,
    body,
  };
  parsedTemplateCache.set(text, parsedTemplate);
  return parsedTemplate;
}

function validateAnnotation(annotation) {
  if (typeof annotation !== 'object' || annotation === null) {
    throw new Error('Template annotation must be a JSON object.');
  }
  if (!annotation.name) throw new Error('Template annotation is missing "name".');

  const controlIds = new Set();
  for (const step of annotation.steps ?? []) {
    if (!step.id || !step.title) throw new Error('Each template step needs an "id" and a "title".');
    for (const control of step.controls ?? []) {
      if (!control.id) throw new Error(`A control in step "${step.id}" is missing "id".`);
      if (controlIds.has(control.id)) throw new Error(`Duplicate control id "${control.id}".`);
      controlIds.add(control.id);
      if (!CONTROL_TYPES.includes(control.type)) {
        throw new Error(`Control "${control.id}" has unknown type "${control.type}".`);
      }
      if (control.type === 'select' && !(Array.isArray(control.options) && control.options.length)) {
        throw new Error(`Select control "${control.id}" needs a non-empty "options" list.`);
      }
    }
  }
}

/** Default values for all controls of a parsed template. */
export function defaultValues(parsedTemplate) {
  const values = {};
  for (const control of parsedTemplate.controls) {
    if (control.default !== undefined) values[control.id] = control.default;
    else if (control.type === 'checkbox') values[control.id] = false;
    else if (control.type === 'select') values[control.id] = optionValue(control.options[0]);
    else values[control.id] = '';
  }
  return values;
}

/** Select options may be plain strings or { value, label } objects. */
export function optionValue(option) {
  return typeof option === 'object' ? option.value : option;
}

export function optionLabel(option) {
  return typeof option === 'object' ? (option.label ?? option.value) : option;
}

/** Fetch template text from a URL (relative or absolute). */
export async function fetchTemplate(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch template (${response.status} ${response.statusText}).`);
  }
  return response.text();
}

/** Fetch the built-in template list. */
export async function fetchBuiltInTemplates() {
  const response = await fetch('templates/index.json');
  if (!response.ok) throw new Error('Could not load the built-in template list.');
  const registry = await response.json();
  return registry.templates ?? [];
}
