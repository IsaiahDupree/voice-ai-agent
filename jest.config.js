const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  // F1245: Test reporting - Jest generates HTML coverage report
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageDirectory: 'coverage',
}

// next/jest overrides transformIgnorePatterns, so we merge after
module.exports = async () => {
  const jestConfig = await createJestConfig(customJestConfig)()
  // Allow ESM-only packages to be transformed
  jestConfig.transformIgnorePatterns = [
    '/node_modules/(?!(cheerio|htmlparser2|dom-serializer|dom-handler|entities|domelementtype|domutils|css-select|css-what|boolbase|nth-check|parse5|parse5-htmlparser2-tree-adapter)/)',
  ]
  return jestConfig
}
