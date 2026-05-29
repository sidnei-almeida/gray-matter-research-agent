const ALLOWED_PATTERN = /^[\d\s+\-*/().^%,eEπPi\s]+$/;
const REPLACEMENTS = {
  pi: Math.PI,
  π: Math.PI,
  e: Math.E,
};

function extractExpression(message) {
  const patterns = [
    /(?:calculate|compute|eval|solve|evaluate)\s+(.+)/i,
    /what is\s+([\d\s+\-*/().^%,eEπPi]+)/i,
    /^([\d\s+\-*/().^%,eEπPi]+)$/,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  const inline = message.match(/([\d.]+\s*[\+\-\*\/\^]\s*[\d.]+(?:\s*[\+\-\*\/\^]\s*[\d.]+)*)/);
  return inline?.[1]?.trim() || message.trim();
}

function normalizeExpression(expr) {
  let normalized = expr
    .replace(/\^/g, '**')
    .replace(/,/g, '.')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\bpi\b/gi, 'π')
    .replace(/\bPI\b/g, 'π');

  for (const [token, value] of Object.entries(REPLACEMENTS)) {
    normalized = normalized.replace(new RegExp(`\\b${token}\\b`, 'g'), String(value));
  }

  return normalized;
}

function safeEvaluate(expr) {
  const normalized = normalizeExpression(expr);

  if (!ALLOWED_PATTERN.test(normalized.replace(/\*\*/g, '').replace(/Math\.PI/g, '').replace(/Math\.E/g, ''))) {
    throw new Error('Expression contains unsupported characters.');
  }

  const fn = new Function(`"use strict"; return (${normalized});`);
  const result = fn();

  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('Could not evaluate expression to a finite number.');
  }

  return result;
}

export function calculate(message) {
  const expression = extractExpression(message);

  try {
    const result = safeEvaluate(expression);
    const steps = [
      `Expression: ${expression}`,
      `Normalized: ${normalizeExpression(expression)}`,
      `Result: ${result}`,
    ];

    return {
      content: `${expression} = ${result}`,
      calculation: {
        expression,
        result,
        steps,
        source: 'calculator',
      },
      toolUsed: 'calculator',
    };
  } catch (error) {
    return {
      content: `Could not compute "${expression}": ${error.message}`,
      calculation: null,
      toolUsed: 'calculator',
      error: true,
    };
  }
}

export function isCalculationQuery(message) {
  const lower = message.toLowerCase();
  return (
    /^(calculate|compute|eval|solve|evaluate)\b/.test(lower) ||
    /^[\d\s+\-*/().^%,eEπPi]+$/.test(message.trim()) ||
    /\d+\s*[\+\-\*\/\^×÷]\s*\d+/.test(message) ||
    /reaction yield|molar mass|limiting reagent/.test(lower)
  );
}
