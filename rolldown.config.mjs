import { defineConfig } from 'rolldown';

const external = [
  'readline/promises',
  'fs/promises',
  'node:readline/promises',
  'node:fs/promises',
];

export default defineConfig([
  {
    input: 'src/index.ts',
    external,
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
    output: {
      file: 'dist/interpreter-node.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      codeSplitting: false,
    },
  },
]);
