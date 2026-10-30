import { baseConfig } from '@marcalexiei/oxlint-config/base';
import { nodeConfig } from '@marcalexiei/oxlint-config/node';
import { typescriptConfig } from '@marcalexiei/oxlint-config/typescript';
import { defineConfig } from 'oxlint';

export default defineConfig({
  env: { node: true },
  extends: [baseConfig, typescriptConfig, nodeConfig],
  // `typescriptConfig` holds rules that need types, which oxlint-tsgolint reads.
  options: { reportUnusedDisableDirectives: 'error', typeAware: true },
  overrides: [
    {
      files: ['**/*.test.ts'],
      rules: {
        // Workflow job names hold `${{ }}` expressions as plain text.
        'no-template-curly-in-string': 'off',
        // node:test reports a test's failure itself; nothing awaits its promise.
        'typescript/no-floating-promises': [
          'error',
          {
            allowForKnownSafeCalls: [
              { from: 'package', package: 'node:test', name: ['test', 'describe', 'it', 'suite'] },
            ],
          },
        ],
      },
    },
  ],
});
