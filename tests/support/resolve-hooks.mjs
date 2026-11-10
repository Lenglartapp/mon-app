// Résolution « à la Vite » pour les tests Node : imports sans extension (./x → ./x.js / .jsx).
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, next) {
    try {
        return await next(specifier, context);
    } catch (err) {
        if (err?.code !== 'ERR_MODULE_NOT_FOUND' || !(specifier.startsWith('.') || specifier.startsWith('/'))) throw err;
        for (const ext of ['.js', '.jsx', '/index.js']) {
            const url = new URL(specifier + ext, context.parentURL);
            if (existsSync(fileURLToPath(url))) return next(url.href, context);
        }
        throw err;
    }
}

// Le client Supabase lit les variables Vite (import.meta.env) absentes sous Node : les tests
// reçoivent un module factice (aucun accès réseau depuis les tests).
const SUPABASE_STUB = `
export const CONNECTIVITY_EVENT = 'droitfil:connectivity';
export const MUST_SET_PASSWORD_KEY = 'df_must_set_password';
export const isServerReachable = () => true;
export const probeServer = async () => true;
export const supabase = null;
`;

export async function load(url, context, next) {
    if (url.endsWith('/src/lib/supabaseClient.js')) {
        return { format: 'module', source: SUPABASE_STUB, shortCircuit: true };
    }
    return next(url, context);
}
