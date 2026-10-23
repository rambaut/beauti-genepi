/**
 * render.js — render a template body into BEAST XML.
 *
 * PROVISIONAL SYNTAX:
 *   ${path}                                  substitute a value (XML-escaped)
 *   {{#if expression}} ... {{else}} ... {{/if}}
 *   {{#each item in list}} ... {{/each}}
 * Expressions are described in template/expressions.js.
 */

import { evaluateExpression, lookupPath } from '../template/expressions.js';
import { escapeXml } from '../utilities.js';

const BLOCK_TAG_PATTERN = /\{\{\s*(#if|#each|else|\/if|\/each)\s*([^}]*?)\s*\}\}/g;
const PLACEHOLDER_PATTERN = /\$\{\s*([\w.]+)\s*\}/g;
// A block tag alone on its line: the whole line (indent and newline) is dropped.
const STANDALONE_TAG_LINE_PATTERN = /^[ \t]*(\{\{\s*(?:#if|#each|else|\/if|\/each)[^}]*\}\})[ \t]*\r?\n/gm;

/** Parse a template body into a tree of text / if / each nodes. */
export function parseBody(templateBody) {
  const body = templateBody.replace(STANDALONE_TAG_LINE_PATTERN, '$1');
  const root = { type: 'root', children: [] };
  const stack = [root];
  let lastIndex = 0;
  let match;
  BLOCK_TAG_PATTERN.lastIndex = 0;

  const innermost = () => stack[stack.length - 1];
  const currentChildren = () => {
    const node = innermost();
    return node.type === 'if' && node.inElse ? node.elseChildren : node.children;
  };

  while ((match = BLOCK_TAG_PATTERN.exec(body)) !== null) {
    if (match.index > lastIndex) {
      currentChildren().push({ type: 'text', text: body.slice(lastIndex, match.index) });
    }
    lastIndex = BLOCK_TAG_PATTERN.lastIndex;
    const [, tag, argument] = match;

    if (tag === '#if') {
      const node = { type: 'if', expression: argument, children: [], elseChildren: [], inElse: false };
      currentChildren().push(node);
      stack.push(node);
    } else if (tag === '#each') {
      const eachMatch = argument.match(/^(\w+)\s+in\s+([\w.]+)$/);
      if (!eachMatch) throw new Error(`Invalid {{#each}}: "${argument}" (expected "item in list").`);
      const node = { type: 'each', itemName: eachMatch[1], listPath: eachMatch[2], children: [] };
      currentChildren().push(node);
      stack.push(node);
    } else if (tag === 'else') {
      if (innermost().type !== 'if') throw new Error('{{else}} outside {{#if}}.');
      innermost().inElse = true;
    } else {
      const expected = tag === '/if' ? 'if' : 'each';
      if (innermost().type !== expected) throw new Error(`Unexpected {{${tag}}}.`);
      stack.pop();
    }
  }
  if (lastIndex < body.length) currentChildren().push({ type: 'text', text: body.slice(lastIndex) });
  if (stack.length > 1) throw new Error(`Unclosed {{#${innermost().type}}} block.`);
  return root;
}

function substitutePlaceholders(text, context) {
  return text.replace(PLACEHOLDER_PATTERN, (_, path) => {
    const value = lookupPath(context, path);
    if (value === undefined || value === null) throw new Error(`No value for \${${path}}.`);
    return escapeXml(value);
  });
}

function renderNodes(nodes, context, output) {
  for (const node of nodes) {
    if (node.type === 'text') {
      output.push(substitutePlaceholders(node.text, context));
    } else if (node.type === 'if') {
      const branch = evaluateExpression(node.expression, context) ? node.children : node.elseChildren;
      renderNodes(branch, context, output);
    } else if (node.type === 'each') {
      for (const item of lookupPath(context, node.listPath) ?? []) {
        renderNodes(node.children, { ...context, [node.itemName]: item }, output);
      }
    }
  }
}

/** Build the render context from the analysis state. */
export function buildRenderContext(state) {
  const taxa = state.taxa.map(taxon => ({
    id: taxon.id,
    sequence: taxon.sequence,
    date: taxon.date ?? null,
  }));
  return {
    ...state.values,
    taxa,
    taxonCount: taxa.length,
    siteCount: state.alignment?.length ?? 0,
    hasDates: taxa.length > 0 && taxa.every(taxon => taxon.date !== null),
  };
}

/** Render a parsed template against the analysis state. */
export function renderXml(parsedTemplate, state) {
  const tree = parseBody(parsedTemplate.body);
  const output = [];
  renderNodes(tree.children, buildRenderContext(state), output);
  return output.join('');
}
