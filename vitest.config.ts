import { defineConfig } from 'vitest/config';

const isProfile = process.env.VITEST_PROFILE === '1';
const isProfileHard = process.env.VITEST_PROFILE === 'hard';

const isProfiling = isProfile || isProfileHard;
const profileTestSuit = isProfileHard ? 'tests/integration/profile-hard.test.ts' : 'tests/integration/profile.test.ts';
const includeSuit = isProfiling ? profileTestSuit : 'tests/**/*.test.ts'
const excludeSuit = isProfiling ? '' : 'tests/integration/profile*.test.ts'

export default defineConfig({
    test: {
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        include: [includeSuit],
        exclude: [excludeSuit],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.d.ts', 'src/cli/**'],
            reportsDirectory: 'coverage',
            reporter: ['text', 'lcov', 'html'],
        },
        execArgv: isProfiling ? [
            '--cpu-prof',
            '--cpu-prof-dir=test-runner-profile',
            '--heap-prof',
            '--heap-prof-dir=test-runner-profile'
        ] : [],
    },
});
