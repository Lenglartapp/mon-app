import React, { useLayoutEffect, useRef } from 'react';

// Menu / panneau qui reste toujours dans l'écran, quelle que soit sa largeur ou celle de la fenêtre :
// décalé à gauche ou à droite s'il dépasse, largeur et hauteur plafonnées (défilement interne).
// À utiliser à la place du <div> du panneau (Colonnes, Filtrer, Configuration, Ajouter…) ;
// `style` garde son positionnement d'origine (fixed / absolute), le recadrage passe par transform.
const MARGIN = 8;

// Zone réellement visible (en coordonnées de getBoundingClientRect). Sur tablette, si la page est
// plus large que l'écran, window.innerWidth peut dépasser ce qu'on voit : on prend le viewport visuel.
const visibleBox = () => {
    const vv = window.visualViewport;
    if (vv) return { left: vv.offsetLeft, right: vv.offsetLeft + vv.width, top: vv.offsetTop, bottom: vv.offsetTop + vv.height };
    return { left: 0, right: document.documentElement.clientWidth, top: 0, bottom: window.innerHeight };
};

export default function FitPanel({ style, children, ...rest }) {
    const ref = useRef(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const fit = () => {
            el.style.transform = '';
            el.style.maxHeight = '';
            el.style.overflowY = '';
            const r = el.getBoundingClientRect();
            const box = visibleBox();
            let dx = 0;
            if (r.right > box.right - MARGIN) dx = box.right - MARGIN - r.right;
            if (r.left + dx < box.left + MARGIN) dx = box.left + MARGIN - r.left;
            if (dx) el.style.transform = `translateX(${Math.round(dx)}px)`;
            const room = box.bottom - Math.max(r.top, box.top + MARGIN) - MARGIN;
            // Défilement interne seulement si le menu est trop haut pour l'écran : sinon rien n'est
            // coupé (ex. la liste « Rechercher un champ » du Filtrer qui dépasse du panneau).
            if (r.height > room) {
                el.style.maxHeight = `${Math.max(160, Math.floor(room))}px`;
                el.style.overflowY = 'auto';
            }
        };
        fit();
        window.addEventListener('resize', fit);
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        return () => { window.removeEventListener('resize', fit); ro.disconnect(); };
    }, []);

    return (
        <div
            ref={ref}
            {...rest}
            style={{ maxWidth: `min(calc(100vw - ${MARGIN * 2}px), calc(100dvw - ${MARGIN * 2}px))`, boxSizing: 'border-box', ...style }}
        >
            {children}
        </div>
    );
}
