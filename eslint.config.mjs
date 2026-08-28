import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Lint configuration.
 *
 * Type-aware rules are enabled: the rules that catch real defects in this
 * codebase — a floating promise on a database write, an unawaited enqueue —
 * need type information to fire at all.
 */
export default tseslint.config(
  {
    ignores: ['node_modules/**', '.next/**', 'coverage/**', 'next-env.d.ts'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      // A dropped promise on a query or an enqueue silently loses work.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // Underscore-prefixed arguments are intentionally unused.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Repository helpers return `any` from generic query casts by design;
      // flagging every one of those would drown the signal.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      // `row!` after a RETURNING clause is provably non-null.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },

  {
    files: ['__tests__/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },

  {
    files: ['pages/**/*.tsx'],
    languageOptions: { globals: { ...globals.browser } },
  },

  {
    // Config files sit outside tsconfig's program, so type-aware rules cannot
    // run on them.
    files: ['*.mjs', '*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
