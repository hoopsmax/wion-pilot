import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

// Playwright reads a selector as XPath when it starts with `xpath=`, `//` or `..`.
// The slash is written as \x2F because ESLint selectors can't contain `/` inside a regex.
const xpathStart = String.raw`/^(xpath=|\x2F\x2F|\.\.)/`;
const locatorCall = 'CallExpression[callee.property.name=/^(locator|frameLocator)$/]';
const noXPathMessage = 'No XPath (CLAUDE.md). Use getByRole, getByLabel, getByText or getByTestId.';

// Each guard turns a CLAUDE.md test rule into a lint error, so `npm run check` catches it.
const testRuleGuards = [
  {
    selector: "CallExpression[callee.property.name='waitForTimeout']",
    message:
      'No fixed waits (CLAUDE.md). Wait for a state instead, e.g. `await expect(locator).toBeVisible()`.',
  },
  { selector: `${locatorCall} > Literal[value=${xpathStart}]`, message: noXPathMessage },
  {
    selector: `${locatorCall} > TemplateLiteral > TemplateElement[value.raw=${xpathStart}]`,
    message: noXPathMessage,
  },
];

// Steps describe behaviour and call page objects; only page objects know how to find elements.
const rawLocatorInStep = {
  selector:
    'CallExpression[callee.property.name=/^(locator|frameLocator|getBy(Role|Label|Text|TestId|Placeholder|Title|AltText))$/]',
  message:
    'Steps call page objects, never raw locators (CLAUDE.md). Add the element to a page object in tests/pages/.',
};

export default defineConfig(
  globalIgnores([
    '.features-gen/',
    'playwright-report/',
    'test-results/',
    'blob-report/',
    'coverage/',
    '.wion/',
    'apps/*/dist/',
  ]),
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'no-restricted-syntax': ['error', ...testRuleGuards],
    },
  },
  {
    files: ['tests/steps/**/*.ts', 'tests/features/**/*.steps.ts'],
    rules: { 'no-restricted-syntax': ['error', ...testRuleGuards, rawLocatorInStep] },
  },
  {
    // JavaScript files (like this one) are not part of the TypeScript program.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
