// node --import ./tests/support/register.mjs --test tests/
import { register } from 'node:module';
register('./resolve-hooks.mjs', import.meta.url);
