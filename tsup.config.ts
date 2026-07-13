import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/dualsense/index.ts',
    react: 'src/dualsense/react.ts',
  },
  outDir: 'lib',
  format: ['esm', 'cjs'],
  outExtension({ format }) {
    return { js: format === 'esm' ? '.js' : '.cjs' }
  },
  platform: 'browser',
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ['dualsense-ts', 'react'],
})
