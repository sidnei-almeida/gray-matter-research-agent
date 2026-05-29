import { isCalculationQuery } from '../services/calculatorService';

const ARXIV_KEYWORDS =
  /\b(paper|papers|article|articles|arxiv|preprint|publication|journal|literature|research on|find recent|latest research|scientific study|studies on)\b/i;

const WIKIPEDIA_KEYWORDS =
  /\b(explain|define|describe|what is|what are|who is|who was|tell me about|concept of|encyclopedia|wikipedia|overview of)\b/i;

const WEB_KEYWORDS =
  /\b(latest|current|today|news|recent developments|live|up to date|up-to-date|2024|2025|2026|breaking|trending|now)\b/i;

export const TOOLS = {
  arxiv: { id: 'arxiv', label: 'ArXiv', icon: '◈' },
  wikipedia: { id: 'wikipedia', label: 'Wikipedia', icon: '◎' },
  web: { id: 'web', label: 'Live Web', icon: '◉' },
  calculator: { id: 'calculator', label: 'Scientific Calculations', icon: '∑' },
  agent: { id: 'agent', label: 'Research Agent', icon: '⚗' },
};

export function routeMessage(message, forcedTool = null) {
  if (forcedTool && TOOLS[forcedTool]) {
    return forcedTool;
  }

  const trimmed = message.trim();
  if (!trimmed) return 'agent';

  if (isCalculationQuery(trimmed)) {
    return 'calculator';
  }

  if (ARXIV_KEYWORDS.test(trimmed)) {
    return 'arxiv';
  }

  if (WEB_KEYWORDS.test(trimmed)) {
    return 'web';
  }

  if (WIKIPEDIA_KEYWORDS.test(trimmed)) {
    return 'wikipedia';
  }

  return 'agent';
}

export async function executeRoutedQuery(message, tool, handlers) {
  switch (tool) {
    case 'arxiv':
      return handlers.arxiv(message);
    case 'wikipedia':
      return handlers.wikipedia(message);
    case 'web':
      return handlers.web(message);
    case 'calculator':
      return handlers.calculator(message);
    default:
      return handlers.agent(message);
  }
}

export function getToolLabel(toolId) {
  return TOOLS[toolId]?.label || 'Research Agent';
}
