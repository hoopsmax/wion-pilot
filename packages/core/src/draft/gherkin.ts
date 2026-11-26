import type { DraftAnswer } from './answer.ts';

export interface DraftOrigin {
  provider: string;
  model: string;
  /** YYYY-MM-DD */
  date: string;
}

/** Tag on every drafted feature, so AI-written scenarios can always be found and filtered. */
export const DRAFT_TAG = '@ai-drafted';

/** The first line of every proposal until `wion review` approves it. */
export function draftHeader(origin: DraftOrigin): string {
  return `# Drafted by ${origin.provider}/${origin.model} on ${origin.date}. Not approved yet.`;
}

/** A Gherkin keyword or marker at the start of a line would end the description early. */
const STARTS_LIKE_GHERKIN =
  /^(Feature|Rule|Background|Scenario Outline|Scenario Template|Scenario|Example|Examples|Given|When|Then|And|But)\b|^[*@#|]/;

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function descriptionLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => (STARTS_LIKE_GHERKIN.test(line) ? `Note: ${line}` : line));
}

/**
 * Our code writes the Gherkin, not the AI: the answer has been checked, and here it gets a fixed
 * layout. The change summary and test plan become the feature's description; missing steps
 * become comments, since they are not steps yet.
 */
export function toGherkin(answer: DraftAnswer, origin: DraftOrigin): string {
  const lines = [draftHeader(origin)];
  if (answer.missingSteps.length > 0) {
    lines.push('# Missing steps (not used below; a person writes them first):');
    for (const missing of answer.missingSteps) {
      lines.push(`#   - "${oneLine(missing.phrase)}": ${oneLine(missing.purpose)}`);
    }
  }
  lines.push(DRAFT_TAG, `Feature: ${oneLine(answer.title)}`);
  const description = descriptionLines(answer.description);
  if (answer.changeSummary !== '') {
    description.push('', ...descriptionLines(`What changed: ${answer.changeSummary}`));
  }
  if (answer.testPlan.length > 0) {
    description.push('', 'Test plan:', ...answer.testPlan.map((item) => `- ${oneLine(item)}`));
  }
  lines.push(...description.map((line) => (line === '' ? '' : `  ${line}`)));
  for (const scenario of answer.scenarios) {
    lines.push('', `  Scenario: ${oneLine(scenario.name)}`);
    lines.push(...scenario.steps.map((step) => `    ${oneLine(step)}`));
  }
  return `${lines.join('\n')}\n`;
}
