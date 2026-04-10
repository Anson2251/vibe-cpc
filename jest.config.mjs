const sharedConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};

export default {
  projects: [
    {
      ...sharedConfig,
      displayName: 'unit',
      testMatch: [
        '<rootDir>/tests/unit/**/*.test.ts',
        '<rootDir>/tests/lexer/**/*.test.ts',
        '<rootDir>/tests/parser/**/*.test.ts',
      ],
    },
    {
      ...sharedConfig,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
    },
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/cli/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
