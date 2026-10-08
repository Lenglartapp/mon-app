import { useLayoutEffect, useState } from "react";

// Hauteur disponible (à utiliser en maxHeight) entre le haut d'un élément et le bas de la fenêtre (moins `bottomGap`).
// Sert aux listes dont SEUL le tableau défile : l'entête de page (titre, recherche, boutons)
// reste en place, la page elle-même ne défile plus et il n'y a qu'une barre de défilement.
// Recalculée au redimensionnement et quand le haut de l'élément bouge (filtres ajoutés…).
export function useFillViewportHeight(ref, { bottomGap = 24, min = 320 } = {}) {
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const h = Math.max(min, Math.floor(window.innerHeight - top - bottomGap) - 1);
      setHeight((prev) => (prev === h ? prev : h));
    };
    measure();
    window.addEventListener("resize", measure);
    // Le contenu au-dessus du tableau peut changer de hauteur (filtres, bandeaux) : on suit.
    const ro = new ResizeObserver(measure);
    let n = el.parentElement;
    while (n && n !== document.body) { ro.observe(n); n = n.parentElement; }
    return () => { window.removeEventListener("resize", measure); ro.disconnect(); };
  }, [ref, bottomGap, min]);
  return height;
}
