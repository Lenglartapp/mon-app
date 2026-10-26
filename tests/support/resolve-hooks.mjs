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
