// oxlint-disable typescript/no-unsafe-member-access
// oxlint-disable typescript/no-unsafe-call
// oxlint-disable typescript/no-unsafe-argument
// oxlint-disable typescript/no-unsafe-assignment
import { defineConfig } from 'rolldown';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const version = pkg.version;

const external = [
  'readline/promises',
  'fs/promises',
  'node:readline/promises',
  'node:fs/promises',
];

const quickjsExternal = ['std', 'os'];

export default defineConfig([
  {
    input: 'src/index.ts',
    external,
    transform: {
      define: {
        __VERSION__: JSON.stringify(version),
      },
    },
    output: {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      codeSplitting: false,
    },
  },
  {
    input: 'src/cli/node-index.ts',
    external,
    transform: {
      define: {
        __VERSION__: JSON.stringify(version),
      },
    },
    output: {
      file: 'dist/interpreter-node.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      codeSplitting: false,
    },
  },
  {
    input: 'src/cli/quickjs-index.ts',
    external: [...external, ...quickjsExternal],
    transform: {
      define: {
        __VERSION__: JSON.stringify(version),
      },
    },
    output: {
      file: 'dist/interpreter-quickjs.mjs',
      format: 'esm',
      sourcemap: true,
      codeSplitting: false,
    },
  },
]);
