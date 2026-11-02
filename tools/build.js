// Bundles the ES-module sources into classic scripts so the app also runs from file://.
// Run after editing anything in js/ or dev/:  npm run build
import { build } from 'esbuild';

const common = { bundle: true, format: 'iife', target: ['chrome100', 'safari15', 'edge100'], minify: true, sourcemap: false, logLevel: 'info', legalComments: 'none' };
await build({ ...common, entryPoints: ['js/main.js'], outfile: 'js/app.bundle.js' });
await build({ ...common, entryPoints: ['dev/dev.js'], outfile: 'dev/dev.bundle.js' });
