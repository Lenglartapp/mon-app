// Styles partagés de la DA (listes Chiffrages / Projets), réutilisés par les autres modules.

/** Tableau MUI DataGrid au style des listes Chiffrages / Projets (à mettre dans le `sx` du DataGrid). */
export const DATAGRID_DA_SX = {
  border: 'none',
  fontFamily: 'inherit',
  '--DataGrid-containerBackground': '#F4F4F4',
  '--DataGrid-rowBorderColor': '#E8E6E2',
  '& .MuiDataGrid-columnHeader': { backgroundColor: '#F4F4F4' },
  '& .MuiDataGrid-columnHeaderTitle': { fontSize: 13, fontWeight: 600, color: '#374151' },
  '& .MuiDataGrid-columnHeaders': { borderBottom: '1px solid #E0DED9' },
  '& .MuiDataGrid-columnSeparator': { color: '#E0DED9' },
  '& .MuiDataGrid-cell': { fontSize: 13, color: '#111827' },
  '& .MuiDataGrid-row:hover': { backgroundColor: '#F4F4F4' },
  '& .MuiDataGrid-footerContainer': { borderTop: '1px solid #E0DED9' },
};

/** Cadre du tableau : même contour que les listes (trait #E0DED9, coins 8 px, sans ombre). */
export const TABLE_FRAME_STYLE = {
  width: '100%', background: 'white', border: '1px solid #E0DED9', borderRadius: '8px', overflow: 'hidden',
};

/** Nuancier unique des pastilles : du bleu nuit (texte blanc) au bleu ciel (texte noir). */
export const BLUE_TONES = [
  { bg: '#1E2447', color: '#FFFFFF' }, // 0 — le plus foncé
  { bg: '#34508F', color: '#FFFFFF' },
  { bg: '#5B7FC4', color: '#FFFFFF' },
  { bg: '#A8C2EC', color: '#111827' },
  { bg: '#D6E4F8', color: '#111827' },
  { bg: '#EEF4FD', color: '#111827' }, // 5 — le plus clair
];

/** Teintes des flux de stock (boutons du journal et pastilles « Flux ») : entrée bleu nuit,
    déplacement bleu moyen, sortie bleu ciel — trois niveaux bien distincts du nuancier. */
export const FLUX_TONES = { IN: 0, MOVE: 2, OUT: 4 };

/** Teinte neutre (hors nuancier) pour les états clos / sans suite : perdu, archivé, annulé… */
export const NEUTRAL_TONE = { bg: '#F4F4F4', color: '#374151' };

/** Statuts de chiffrage → teinte du nuancier (du plus avancé, bleu nuit, au plus en amont, bleu ciel).
    `null` = gris neutre (états clos). */
export const CHIFFRAGE_STATUS_TONE = {
  DRAFT: 5, IN_PROGRESS: 4, REVISE: 3, PENDING_APPROVAL: 2, VALIDATED: 1, ORDERED: 0,
  ORDER_COMPLETED: null, LOST: null,
};

/** Statuts de projet → teinte du nuancier (même logique). */
export const PROJECT_STATUS_TONE = { TODO: 4, IN_PROGRESS: 2, SAV: 1, DONE: 0, ARCHIVED: null };

/** Couleurs { bg, color } d'une teinte (0 à 5) ou du neutre (null). */
export const toneColors = (tone) => (tone == null ? NEUTRAL_TONE : BLUE_TONES[Math.max(0, Math.min(BLUE_TONES.length - 1, tone))]);
