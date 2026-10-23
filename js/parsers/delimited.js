/**
 * delimited.js — CSV/TSV parser for metadata tables.
 */

/**
 * Parse delimited text into { headers, rows } where rows are arrays of strings.
 * The delimiter is tab if the first line contains one, otherwise comma.
 * Handles double-quoted fields with embedded delimiters, quotes and newlines.
 */
export function parseDelimited(text) {
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  const records = [];
  let field = '';
  let record = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') { field += '"'; index++; }
        else inQuotes = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      inQuotes = true;
    } else if (character === delimiter) {
      record.push(field); field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      record.push(field); field = '';
      records.push(record); record = [];
    } else {
      field += character;
    }
  }
  if (field !== '' || record.length) { record.push(field); records.push(record); }

  const nonEmptyRecords = records.filter(fields => fields.some(value => value.trim() !== ''));
  if (nonEmptyRecords.length === 0) throw new Error('The metadata file is empty.');

  const [headers, ...rows] = nonEmptyRecords.map(fields => fields.map(value => value.trim()));
  return { headers, rows };
}
