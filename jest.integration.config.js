/**
 * Separate Jest config for live integration tests that need real network access.
 * Bypasses next/jest (which force-loads jest.setup.js and overwrites VAPI_API_KEY)
 * and wires up the Next.js SWC transformer directly.
 *
 * Run: npx jest --config jest.integration.config.js
 */
module.exports = {
  displayName: 'integration',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/integration/vapi-coverage.test.ts'],
  testTimeout: 30000,
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': [
      require.resolve('next/dist/build/swc/jest-transformer'),
      {
        nextConfig: {},
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}
