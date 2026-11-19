// Vice Cover Studio — program entrypoint (Node 22, standard library only).
//
// The app itself is plain static files under app/ (index.html plus its
// modules, styles, fonts and sample photos) that any static server can
// serve offline. This program hands those files in: it copies app/ and
// screenshots/ next to this file into the output directory and writes
// output/dossier.json, the summary the judge reads, using the vendored
// make.fun library. Outside the grader, MAKEFUN_OUTPUT_DIR stands in
// for /output, so a local run looks like:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The program is deterministic: the same repository always produces the
// same bytes in the output directory.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(sourceName) {
  const source = join(repoRoot, sourceName);
  const target = join(outputDir, sourceName);
  if (!existsSync(source)) return;
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

function writeDossier() {
  // The scorer's own caps (reference/gate.json): text_max_bytes shapes
  // the dossier text; the other caps refuse an entry the scorer would
  // refuse, so the program hands in only what fits them.
  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
}

mkdirSync(outputDir, { recursive: true });
copyTree('app');
copyTree('screenshots');
writeDossier();
