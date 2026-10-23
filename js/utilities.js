/**
 * utilities.js — small shared helpers.
 */

/** Escape a string for safe insertion into HTML. */
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape a string for safe insertion into XML text or attribute values. */
export function escapeXml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Trigger a browser download of a string or Blob. */
export function downloadBlob(contentOrBlob, mimeType, filename) {
  const blob = contentOrBlob instanceof Blob
    ? contentOrBlob
    : new Blob([contentOrBlob], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Read a File as text. */
export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** Open a native file picker and resolve with the chosen File (or null). */
export function pickFile(accept) {
  return new Promise(resolvevent => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.addEventListener('change', () => resolve(input.files[0] ?? null));
    input.click();
  });
}

/**
 * Make an element a file drop target.
 * @param {HTMLElement} element
 * @param {(file: File) => void} onDrop
 */
export function wireDropZone(element, onDrop) {
  element.addEventListener('dragover', event => {
    event.preventDefault();
    element.classList.add('drag-over');
  });
  element.addEventListener('dragleave', () => element.classList.remove('drag-over'));
  element.addEventListener('drop', event => {
    event.preventDefault();
    element.classList.remove('drag-over');
    const file = event.dataTransfer.files[0];
    if (file) onDrop(file);
  });
}

/** Create an element from an HTML string (single root). */
export function elementFromHtml(html) {
  const templateElement = document.createElement('template');
  templateElement.innerHTML = html.trim();
  return templateElement.content.firstElementChild;
}

/** Return a debounced version of callback. */
export function debounce(callback, delayMs) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delayMs);
  };
}
