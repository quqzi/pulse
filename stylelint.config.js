/** @type {import('stylelint').Config} */
export default {
  rules: {
    'color-no-invalid-hex': true,
    'color-named': 'never',
  },
  overrides: [
    {
      // Svelte component files: parse with postcss-html, also ban raw hex in color/background/border
      files: ['src/**/*.svelte'],
      customSyntax: 'postcss-html',
      rules: {
        'declaration-property-value-disallowed-list': {
          '/^color/': ['/^#/'],
          '/^background(?!-image)/': ['/^#[0-9a-fA-F]{3,8}$/'],
          'border-color': ['/^#/'],
        },
      },
    },
  ],
  ignoreFiles: ['node_modules/**', '.svelte-kit/**', 'build/**'],
};
