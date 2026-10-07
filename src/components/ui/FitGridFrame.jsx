import React, { useLayoutEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { useFillViewportHeight } from '../../lib/hooks/useFillViewportHeight';
import { TABLE_FRAME_STYLE } from '../../lib/constants/daStyles';

// Cadre d'un tableau MUI DataGrid qui se comporte comme les listes Chiffrages / Projets :
// - hauteur = place restante jusqu'en bas de l'écran (la page ne défile plus, seul le tableau défile) ;
// - mais se referme sur les lignes quand il y en a peu (pas de grand vide encadré) ;
// - barre de défilement verticale masquée (classe df-grid-fit, cf. index.css).
// Le DataGrid exige une hauteur fixe : on prend le minimum entre la place disponible et la
// hauteur réelle de son contenu (en-têtes + lignes + pied), mesurée en continu.
export default function FitGridFrame({ children }) {
  const ref = useRef(null);
  const fill = useFillViewportHeight(ref);
  const [contentH, setContentH] = useState(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const measure = () => {
      const q = (sel) => root.querySelector(sel)?.offsetHeight || 0;
      const h = q('.MuiDataGrid-columnHeaders') + q('.MuiDataGrid-virtualScrollerContent') + q('.MuiDataGrid-footerContainer')
        + q('.MuiDataGrid-scrollbar--horizontal') + 2; // + cadre
      setContentH((prev) => (prev === h ? prev : h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    const mo = new MutationObserver(() => {
      root.querySelectorAll('.MuiDataGrid-virtualScrollerContent, .MuiDataGrid-columnHeaders, .MuiDataGrid-footerContainer').forEach((el) => ro.observe(el));
      measure();
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);

  const height = fill == null ? 600 : Math.max(220, Math.min(fill, contentH || fill));
  return (
    <Box ref={ref} className="df-grid-fit" sx={{ ...TABLE_FRAME_STYLE, height }}>
      {children}
    </Box>
  );
}
