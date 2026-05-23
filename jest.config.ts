import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Use CommonJS-compatible settings for the Jest runtime.
          // The rest of the project uses "bundler" / "esnext" which Jest
          // can't run directly.
          module: 'commonjs',
          moduleResolution: 'node',
          jsx: 'react-jsx',
        },
      },
    ],
  },
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.ts',
    '<rootDir>/src/__tests__/**/*.test.tsx',
  ],
  // Reset all mocks automatically between tests to prevent state leakage.
  clearMocks: true,
  // Coverage config – run with `npm run test:coverage`.
  collectCoverageFrom: [
    'src/lib/**/*.ts',
    '!src/lib/**/*.d.ts',
  ],
  coverageProvider: 'v8',
  coverageReporters: ['text', 'lcov'],
};

export default config;
