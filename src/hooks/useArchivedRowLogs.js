import { useEffect, useMemo, useState } from 'react';
import { fetchRowLogs } from '../lib/lineLogs';

/**
 * Charge (à la demande) l'historique « Modif … » archivé dans `line_logs` pour les
 * lignes données. Ne se recharge que si le parent ou la liste des lignes change
 * (pas à chaque modification d'une cellule : les nouveaux journaux de la session
 * sont déjà dans row.comments).
 * @param {string} parentId  id du chiffrage ou du projet
 * @param {object[]} rows
 * @param {boolean} [enabled=true]
 * @returns {{ byRow: Map<string, object[]>, loading: boolean, error: boolean }}
 */
export function useArchivedRowLogs(parentId, rows, enabled = true) {
  const [state, setState] = useState({ byRow: new Map(), loading: false, error: false });

  // Clé stable : ids des lignes + pointeurs d'archive (pas le contenu des cellules).
  const key = useMemo(() => {
    if (!enabled || !Array.isArray(rows)) return '';
    return rows.map(r => `${r?.id}:${(r?.__logArchive || []).map(x => `${x?.p}/${x?.r}/${x?.until}`).join(',')}`).join('|');
  }, [rows, enabled]);

  useEffect(() => {
    if (!enabled || !key) return undefined;
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: false }));
    fetchRowLogs(parentId, rows)
      .then(byRow => { if (!cancelled) setState({ byRow, loading: false, error: false }); })
      .catch(e => {
        console.warn('[useArchivedRowLogs] historique archivé indisponible :', e?.message || e);
        if (!cancelled) setState(s => ({ ...s, loading: false, error: true }));
      });
    return () => { cancelled = true; };
    // rows volontairement hors dépendances : `key` résume ce qui compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentId, key, enabled]);

  return state;
}
