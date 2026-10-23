/**
 * fasta.js — minimal FASTA alignment parser.
 */

/**
 * Parse FASTA text into { sequences: [{ id, sequence }], length }.
 * Throws if the file is empty, has duplicate names, or is not aligned.
 */
export function parseFasta(text) {
  const records = [];
  let currentRecord = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';')) continue;
    if (line.startsWith('>')) {
      currentRecord = { id: line.slice(1).trim(), lines: [] };
      if (!currentRecord.id) throw new Error('A sequence has an empty name.');
      records.push(currentRecord);
    } else {
      if (!currentRecord) throw new Error('File does not look like FASTA (no ">" header line).');
      currentRecord.lines.push(line.replace(/\s+/g, ''));
    }
  }

  if (records.length === 0) throw new Error('No sequences found.');

  const seenIds = new Set();
  for (const record of records) {
    if (seenIds.has(record.id)) throw new Error(`Duplicate sequence name: ${record.id}`);
    seenIds.add(record.id);
  }

  const sequences = records.map(record => ({
    id: record.id,
    sequence: record.lines.join('').toUpperCase(),
  }));
  const length = sequences[0].sequence.length;
  const unaligned = sequences.find(entry => entry.sequence.length !== length);
  if (unaligned) {
    throw new Error(
      `Sequences are not aligned: "${unaligned.id}" has length ${unaligned.sequence.length}, expected ${length}.`
    );
  }
  return { sequences, length };
}
