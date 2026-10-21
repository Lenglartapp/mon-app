// Génère src/theme/tokens.css depuis src/theme/palette.js.
import { writeFileSync } from 'node:fs';
import { PALETTE } from '../src/theme/palette.js';

const block = (i) => Object.entries(PALETTE).map(([k, v]) => `  --df-${k}: ${v[i]};`).join('\n');
const css = `/* Généré depuis src/theme/palette.js (node scripts/theme-css.mjs) : ne pas éditer à la main. */
:root {
${block(0)}
  color-scheme: light;
}
:root[data-theme="dark"] {
${block(1)}
  color-scheme: dark;
  --df-chip-shift: 64%; /* pastilles calculées (grille) : même teinte, assombrie */
}
`;
writeFileSync(new URL('../src/theme/tokens.css', import.meta.url), css);
console.log('tokens.css écrit');
