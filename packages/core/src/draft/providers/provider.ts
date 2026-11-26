import type { Usage } from '../prices.ts';
import type { Prompt } from '../prompt.ts';

/**
 * What every provider gives back: the answer's raw text, the model that wrote it, and its tokens.
 * The text is checked afterwards (parseAnswerText), so a call is logged even when its answer is
 * unusable.
 */
export interface ProviderReply {
  text: string;
  /** The model that answered; with a fallback this can differ from the one asked for. */
  model: string;
  usage: Usage;
}

/**
 * One interface for every AI provider (CLAUDE.md). `none` is not a provider: with it, wion makes
 * no call and prints the prompt instead (see none.ts).
 */
export interface Provider {
  name: string;
  /** True when the provider calls a model; only those calls go into the ledger. */
  callsAModel: boolean;
  draft(prompt: Prompt): Promise<ProviderReply>;
}
