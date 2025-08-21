module.exports = {
  extends: ['@commitlint/config-conventional'],
  // Optional: constrain scopes to your SDK areas
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'core',
        'enums',
        'guards',
        'interceptors',
        'interfaces',
        'services',
        'shared',
        'store',
        'tokens',
        'utils',
        'build',
        'release',
        'docs',
        'ci'
      ]
    ]
  }
};
