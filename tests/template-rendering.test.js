/**
 * Tests for template parsing, XML rendering and input parsers.
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parseDate } from '../js/parsers/dates.js';
import { parseDelimited } from '../js/parsers/delimited.js';
import { parseFasta } from '../js/parsers/fasta.js';
import { evaluateExpression } from '../js/template/expressions.js';
import { defaultValues, parseTemplate } from '../js/template/loader.js';
import { renderXml } from '../js/xml/render.js';

const readProjectFile = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function exampleState(valueOverrides = {}) {
  const parsedTemplate = parseTemplate(readProjectFile('templates/basic-dated-phylogeny.xml'));
  const { sequences, length } = parseFasta(readProjectFile('examples/test.fasta'));
  return {
    parsedTemplate,
    state: {
      values: { ...defaultValues(parsedTemplate), ...valueOverrides },
      alignment: { fileName: 'test.fasta', length, dataType: 'nucleotide' },
      taxa: sequences.map(({ id, sequence }) => ({
        id, sequence, date: parseDate(id.split('|').at(-1))?.decimal ?? null,
      })),
    },
  };
}

test('expressions', () => {
  const context = { clockModel: 'ucln', gamma: false, taxon: { date: 2020.5 } };
  assert.equal(evaluateExpression('clockModel == "ucln"', context), true);
  assert.equal(evaluateExpression('clockModel != "ucln"', context), false);
  assert.equal(evaluateExpression('!gamma', context), true);
  assert.equal(evaluateExpression('taxon.date', context), true);
});

test('dates', () => {
  assert.equal(parseDate('2020').decimal, 2020.5);
  assert.ok(Math.abs(parseDate('2020-01-01').decimal - (2020 + 0.5 / 366)) < 1e-9);
  assert.equal(parseDate('2020-02').precision, 'month');
  assert.equal(parseDate('not a date'), null);
  assert.equal(parseDate('2020-13-01'), null);
});

test('FASTA parser rejects unaligned sequences', () => {
  assert.throws(() => parseFasta('>a\nACGT\n>b\nACG\n'), /not aligned/);
  assert.throws(() => parseFasta('>a\nACGT\n>a\nACGT\n'), /Duplicate/);
});

test('delimited parser handles quoted fields', () => {
  const { headers, rows } = parseDelimited('name,date\n"A, quoted",2020-01-01\n');
  assert.deepEqual(headers, ['name', 'date']);
  assert.deepEqual(rows, [['A, quoted', '2020-01-01']]);
});

test('example template parses with expected steps', () => {
  const { parsedTemplate } = exampleState();
  assert.equal(parsedTemplate.meta.name, 'Basic dated phylogeny');
  assert.deepEqual(parsedTemplate.steps.map(step => step.id), ['substitution', 'clock', 'tree-prior', 'mcmc']);
});

test('strict clock XML', () => {
  const { parsedTemplate, state } = exampleState();
  const xml = renderXml(parsedTemplate, state);
  assert.ok(xml.startsWith('<?xml'));
  assert.match(xml, /<strictClockBranchRates id="branchRates">/);
  assert.doesNotMatch(xml, /discretizedBranchRates/);
  assert.match(xml, /<gammaShape/);
  assert.equal((xml.match(/<taxon id=/g) ?? []).length, 6);
  assert.match(xml, /chainLength="10000000"/);
  assert.doesNotMatch(xml, /\$\{|\{\{/);
});

test('relaxed clock XML without gamma', () => {
  const { parsedTemplate, state } = exampleState({ clockModel: 'ucln', gamma: false, fileStem: 'run1' });
  const xml = renderXml(parsedTemplate, state);
  assert.match(xml, /<discretizedBranchRates id="branchRates">/);
  assert.doesNotMatch(xml, /strictClockBranchRates/);
  assert.doesNotMatch(xml, /gammaShape|idref="alpha"/);
  assert.match(xml, /fileName="run1\.log"/);
});

test('taxon names are XML-escaped', () => {
  const { parsedTemplate, state } = exampleState();
  state.taxa[0].id = 'A&B<1>|2020';
  const xml = renderXml(parsedTemplate, state);
  assert.match(xml, /<taxon id="A&amp;B&lt;1&gt;\|2020">/);
});
