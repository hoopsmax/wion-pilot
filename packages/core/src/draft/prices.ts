/** Tokens one AI call used, as the provider reports them. */
export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

interface Price {
  /** US dollars per million input tokens. */
  input: number;
  /** US dollars per million output tokens. */
  output: number;
}

/**
 * Anthropic's list prices (November 2026). An estimate for the ledger, not a bill: the provider's
 * own console is the truth. Claude Haiku 5.5 costs more above 100K input tokens; drafts stay far
 * below that.
 */
const CLAUDE_PRICES: Record<string, Price> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

/** Estimated cost in US dollars; undefined when the price is not known. */
export function estimateCost(provider: string, model: string, usage: Usage): number | undefined {
  // A local model costs electricity, not money per token.
  if (provider === 'ollama') return 0;
  const price = provider === 'claude' ? CLAUDE_PRICES[model] : undefined;
  if (!price) return undefined;
  const dollars = (usage.inputTokens * price.input + usage.outputTokens * price.output) / 1_000_000;
  return Math.round(dollars * 1_000_000) / 1_000_000;
}
