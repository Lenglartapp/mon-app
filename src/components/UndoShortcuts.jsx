import React from 'react';
import { useLocation } from 'react-router-dom';
import { undo, redo, resetUndo, UNDO_TOAST_EVENT } from '../lib/undoManager';

// Ctrl+Z / Cmd+Z → annuler ; Ctrl+Maj+Z / Cmd+Maj+Z / Ctrl+Y → rétablir (tableaux, cf.
// lib/undoManager). Laissé au navigateur quand on tape dans un champ (annulation de
// frappe) ou quand une fenêtre est ouverte. Petit message en bas de l'écran.
const isTyping = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

export default function UndoShortcuts() {
  const { pathname } = useLocation();
  const [message, setMessage] = React.useState(null);

  // Changement de page : rien à annuler sur la suivante.
  React.useEffect(() => { resetUndo(); }, [pathname]);

  React.useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = String(e.key || '').toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = (key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey && !e.metaKey);
      if (!isUndo && !isRedo) return;
      if (isTyping(document.activeElement)) return;               // annulation de frappe du navigateur
      if (document.querySelector('.MuiDialog-root, .MuiModal-root:not(.MuiPopover-root)')) return; // fenêtre ouverte
      e.preventDefault();
      if (isUndo) undo(); else redo();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  React.useEffect(() => {
    let t;
    const onToast = (e) => {
      setMessage(e.detail?.text || null);
      clearTimeout(t);
      t = setTimeout(() => setMessage(null), 2500);
    };
    window.addEventListener(UNDO_TOAST_EVENT, onToast);
    return () => { window.removeEventListener(UNDO_TOAST_EVENT, onToast); clearTimeout(t); };
  }, []);

  if (!message) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 2000,
        background: '#1E2447', color: 'white', borderRadius: 8, padding: '9px 16px',
        fontSize: 13, fontFamily: 'Roboto, system-ui, sans-serif', boxShadow: '0 10px 25px rgba(17,24,39,0.25)',
        maxWidth: 'calc(100vw - 32px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}
    >
      {message}
    </div>
  );
}
