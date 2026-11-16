import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import ts from 'typescript';

const root = new URL('../src/components/cupcake/', import.meta.url);

// Use actual Cupcake modules and their normal relative imports in the Node-only
// legacy tests. This fixture supplies the original entry path, no account
// session and no network. Tests provide their own storage/media as needed.
globalThis.window ??= Object.assign(new EventTarget(), {
  location: { pathname: '/cupcake', origin: 'https://fixture.invalid' },
});
globalThis.fetch = () => { throw Error('Unexpected network in a source fixture'); };

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(root.href) && specifier.startsWith('./') && !extname(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.startsWith(root.href) || !url.endsWith('.ts')) return nextLoad(url, context);
    // Erasing TS alone is insufficient for constructor parameter properties.
    const source = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;
    return { format: 'module', source, shortCircuit: true };
  },
});

export function importCupcakeSource(name) {
  if (!/^[A-Za-z0-9]+\.ts$/.test(name)) throw Error(`Unexpected fixture module: ${name}`);
  return import(new URL(name, root).href);
}
