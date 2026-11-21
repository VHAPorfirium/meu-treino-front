/**
 * Trava de tema claro/escuro — roda antes de todo `npm run build` (prebuild).
 *
 * As cores `ink`, `paper`, `card`, `chip`, `done`, `skip`... MUDAM entre o tema
 * claro e o escuro. Branco (`text-white`) não muda. Juntar os dois é o que gera
 * "botão branco com letra branca" no modo escuro. Este script procura essas
 * combinações dentro de uma mesma string de classes e falha o build.
 *
 * Como corrigir cada caso:
 *   bg-ink + text-white/text-paper   →  bg-inverse + text-on-inverse
 *   bg-done/skip/replace + text-white →  text-on-done / text-on-skip / text-on-replace
 *   bg-ink/NN (fundo de modal)        →  bg-black/NN
 *   bg-white + text-ink/muted         →  bg-card (ou mantenha bg-white só em imagens)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE_DIRECTORIES = ['app', 'components', 'lib'];
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

const FORBIDDEN_COMBINATIONS = [
  {
    description: 'bg-ink com texto claro fixo/invertido — use bg-inverse + text-on-inverse',
    matches: (classNames) => classNames.has('bg-ink') && hasAny(classNames, ['text-white', 'text-paper']),
  },
  {
    description: 'fundo de estado com text-white — use text-on-done / text-on-skip / text-on-replace',
    matches: (classNames) =>
      hasAny(classNames, ['bg-done', 'bg-skip', 'bg-replace']) && classNames.has('text-white'),
  },
  {
    description: 'text-white sobre fundo que muda com o tema (paper/card/chip/sand)',
    matches: (classNames) =>
      hasAny(classNames, ['bg-paper', 'bg-card', 'bg-chip', 'bg-sand']) && classNames.has('text-white'),
  },
  {
    description: 'bg-white (fixo) com texto que muda com o tema — use bg-card',
    matches: (classNames) =>
      classNames.has('bg-white') && hasAny(classNames, ['text-ink', 'text-ink2', 'text-muted', 'text-muted2']),
  },
  {
    description: 'fundo de modal com bg-ink/NN (fica claro no modo escuro) — use bg-black/NN',
    matches: (classNames) => [...classNames].some((className) => /^bg-ink\/\d+$/.test(className)),
  },
];

function hasAny(classNames, candidates) {
  return candidates.some((candidate) => classNames.has(candidate));
}

function listSourceFiles(directory) {
  return readdirSync(directory).flatMap((entryName) => {
    const entryPath = join(directory, entryName);
    if (statSync(entryPath).isDirectory()) return listSourceFiles(entryPath);
    return SOURCE_EXTENSIONS.some((extension) => entryName.endsWith(extension)) ? [entryPath] : [];
  });
}

/**
 * Quebra o código em trechos separados por aspas e por `${ }` — assim cada
 * ramo de um ternário dentro de className é avaliado sozinho. Variantes
 * (hover:, disabled:...) são ignoradas: só a cor "de repouso" conta.
 */
function extractClassStrings(sourceCode) {
  const segmentSeparatorPattern = /["'`]|\$\{|\}/g;
  const classStrings = [];
  let segmentStartIndex = 0;
  for (const separatorMatch of [...sourceCode.matchAll(segmentSeparatorPattern), { index: sourceCode.length }]) {
    const segment = sourceCode.slice(segmentStartIndex, separatorMatch.index);
    const baseClassNames = segment.split(/\s+/).filter((token) => token && !token.includes(':'));
    if (baseClassNames.length) classStrings.push({ index: segmentStartIndex, classNames: new Set(baseClassNames) });
    segmentStartIndex = separatorMatch.index + (separatorMatch[0]?.length ?? 0);
  }
  return classStrings;
}

const violations = [];
for (const sourceDirectory of SOURCE_DIRECTORIES) {
  for (const filePath of listSourceFiles(sourceDirectory)) {
    const sourceCode = readFileSync(filePath, 'utf8');
    for (const { index, classNames } of extractClassStrings(sourceCode)) {
      for (const combination of FORBIDDEN_COMBINATIONS) {
        if (!combination.matches(classNames)) continue;
        const lineNumber = sourceCode.slice(0, index).split('\n').length;
        violations.push(`${relative('.', filePath)}:${lineNumber}  ${combination.description}`);
      }
    }
  }
}

if (violations.length) {
  console.error('\n✖ Combinações de cor que quebram o modo escuro:\n');
  for (const violation of violations) console.error('  ' + violation);
  console.error('\nVeja o topo de scripts/check-theme-classes.mjs para saber como corrigir.\n');
  process.exit(1);
}
console.log('✔ Cores do tema OK (claro e escuro).');
