/**
 * expressions.js — the tiny expression language shared by template
 * conditionals ({{#if ...}}) and control annotations ("visibleIf").
 *
 * Supported forms:
 *   name            truthy test of a (dotted) path
 *   !name           falsy test
 *   name == "x"     equality with a string, number or boolean literal
 *   name != "x"     inequality
 */

/** Look up a dotted path (e.g. "taxon.date") in a context object. */
export function lookupPath(context, path) {
  let current = context;
  for (const part of path.split('.')) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function parseLiteral(text) {
  const literal = text.trim();
  if (/^".*"$/.test(literal) || /^'.*'$/.test(literal)) return literal.slice(1, -1);
  if (literal === 'true') return true;
  if (literal === 'false') return false;
  if (literal !== '' && !isNaN(Number(literal))) return Number(literal);
  throw new Error(`Invalid literal in expression: ${literal}`);
}

function isTruthy(value) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

/** Evaluate an expression string against a context. */
export function evaluateExpression(expression, context) {
  const text = expression.trim();
  const comparison = text.match(/^([\w.]+)\s*(==|!=)\s*(.+)$/);
  if (comparison) {
    const [, path, operator, literal] = comparison;
    // Compare as strings so "4" == 4 behaves as template authors expect.
    const isEqual = String(lookupPath(context, path)) === String(parseLiteral(literal));
    return operator === '==' ? isEqual : !isEqual;
  }
  if (text.startsWith('!')) return !isTruthy(lookupPath(context, text.slice(1).trim()));
  if (/^[\w.]+$/.test(text)) return isTruthy(lookupPath(context, text));
  throw new Error(`Invalid expression: ${expression}`);
}
