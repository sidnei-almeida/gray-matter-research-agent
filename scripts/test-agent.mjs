#!/usr/bin/env node
/**
 * End-to-end check of the agentic loop against the live Groq API.
 *
 *   npm run test:agent                       # reads GROQ_API_KEY from .env
 *   npm run test:agent -- "your question" deep
 *   GROQ_API_KEY=... node scripts/test-agent.mjs
 *
 * Prints the tools the model chose, the evidence it gathered and the answer,
 * so routing regressions are visible without deploying.
 */

import { invokeAgent } from '../api/_lib/agent.js';
import { DEFAULT_MODEL, hasApiKey } from '../api/_lib/llm.js';

const DEFAULT_CASES = [
  { question: 'What is catalysis?', depth: 'quick', expect: 'wikipedia or web, never arXiv-only' },
  { question: 'Qdrant vs Milvus for a production RAG stack in 2026', depth: 'standard', expect: 'web_search, not paper_search' },
  { question: 'Find recent papers on graph neural networks for molecular property prediction', depth: 'standard', expect: 'search_scientific_papers' },
  { question: 'How many moles are in 2.4 g of glucose?', depth: 'quick', expect: 'calculator' },
  { question: 'Heisenberg', depth: 'quick', expect: 'easter egg, no tools' },
];

function summarize(result, elapsedMs) {
  const lines = [
    `  mode           ${result.mode}  (reasoning_effort: ${result.reasoning_effort || 'n/a'})`,
    `  intent         ${result.intent ?? 'null'}`,
    `  tools_used     ${result.tools_used.join(', ') || '(none)'}`,
    `  sources        ${result.sources.length}   papers: ${result.papers.length}`,
    `  confidence     ${result.confidence}`,
    `  elapsed        ${(elapsedMs / 1000).toFixed(1)}s`,
  ];

  if (result.research_plan.length) {
    lines.push('  plan');
    result.research_plan.forEach((step) => lines.push(`    - ${step}`));
  }
  if (result.limitations.length) {
    lines.push('  limitations');
    result.limitations.forEach((l) => lines.push(`    ! ${l}`));
  }

  lines.push('  answer');
  const answer = String(result.answer || '').split('\n').slice(0, 12);
  answer.forEach((line) => lines.push(`    ${line}`));

  return lines.join('\n');
}

async function runCase({ question, depth, expect }) {
  console.log(`\n── ${question}   [depth: ${depth}]`);
  if (expect) console.log(`  expect         ${expect}`);

  const start = Date.now();
  try {
    const result = await invokeAgent({
      messages: [{ role: 'user', content: question }],
      depth,
    });
    console.log(summarize(result, Date.now() - start));
    return result.mode !== 'pipeline';
  } catch (error) {
    console.log(`  FAILED         ${error.message}`);
    return false;
  }
}

async function main() {
  if (!hasApiKey()) {
    console.error('GROQ_API_KEY is not set. Export it and re-run.');
    process.exit(1);
  }

  console.log(`Model: ${DEFAULT_MODEL}`);

  const [question, depth = 'standard'] = process.argv.slice(2);
  const cases = question ? [{ question, depth }] : DEFAULT_CASES;

  let agenticRuns = 0;
  for (const testCase of cases) {
    if (await runCase(testCase)) agenticRuns += 1;
  }

  console.log(`\n${agenticRuns}/${cases.length} ran on the agentic loop (rest fell back to the pipeline).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
