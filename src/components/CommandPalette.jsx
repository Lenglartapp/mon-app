import React, { useState, useEffect, useCallback, useImperativeHandle } from 'react';
import { Command } from 'cmdk';
import {
  Home, Layers, FileText, Calendar, Truck,
  Package, BarChart2, Settings, Search,
} from 'lucide-react';
import { can } from '../lib/authz';
import './CommandPalette.css';

const slugify = (str) =>
  (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const STATUS_LABEL = {
  TODO: 'À commencer',
  IN_PROGRESS: 'En cours',
  DONE: 'Terminé',
  SAV: 'SAV',
  ARCHIVED: 'Archivé',
  DRAFT: 'Brouillon',
  VALIDATED: 'Validé',
  ORDER_COMPLETED: 'Terminé',
};

const STATUS_DOT = {
  TODO:      '#9CA3AF',
  IN_PROGRESS: '#3B82F6',
  DONE:      '#10B981',
  SAV:       '#F59E0B',
  ARCHIVED:  '#D1D5DB',
  DRAFT:     '#9CA3AF',
  VALIDATED: '#10B981',
};

const NAV_ITEMS = [
  { id: 'home',          label: 'Accueil',      path: '/',            icon: Home,      perm: null },
  { id: 'prodList',      label: 'Production',   path: '/production',  icon: Layers,    perm: 'nav.production' },
  { id: 'chiffrageRoot', label: 'Chiffrage',    path: '/chiffrage',   icon: FileText,  perm: 'nav.chiffrage' },
  { id: 'planning',      label: 'Planning',     path: '/planning',    icon: Calendar,  perm: 'planning.view' },
  { id: 'logistique',    label: 'Logistique',   path: '/logistique',  icon: Truck,     perm: 'nav.logistique' },
  { id: 'inventory',     label: 'Inventaire',   path: '/inventaire',  icon: Package,   perm: 'nav.inventory' },
  { id: 'performance',   label: 'Performance',  path: '/performance', icon: BarChart2, perm: 'nav.performance' },
  { id: 'settings',      label: 'Paramètres',   path: '/parametres',  icon: Settings,  perm: null },
];

const CommandPalette = React.forwardRef(function CommandPalette(
  { projects = [], minutes = [], navigate, currentUser },
  ref
) {
  const [open, setOpen] = useState(false);

  // Expose open() pour le bouton dans le header
  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const run = useCallback((fn) => {
    setOpen(false);
    fn();
  }, []);

  const allowedNav = NAV_ITEMS.filter(
    item => !item.perm || can(currentUser, item.perm)
  );

  // On exclut les archivés pour les projets, les terminés pour les devis
  const visibleProjects = projects.filter(p => p.status !== 'ARCHIVED');
  const canChiffrage = can(currentUser, 'nav.chiffrage');
  const visibleMinutes = canChiffrage
    ? minutes.filter(m => m.status !== 'ORDER_COMPLETED')
    : [];

  // Liste UNIFIÉE projets + chiffrages : cmdk trie par pertinence au sein d'un même
  // groupe. En les fusionnant, le meilleur match remonte en premier QUEL QUE SOIT le
  // type (avant : 2 groupes séparés → tout projet passait avant tout chiffrage).
  // Le `value` (texte recherché) ne contient que nom + champs utiles, sans mot parasite,
  // pour ne pas fausser le score.
  const results = [
    ...visibleProjects.map(p => ({
      kind: 'project',
      id: p.id,
      label: p.name || 'Sans nom',
      sub: [p.manager, p.location].filter(Boolean).join(' · '),
      status: p.status,
      value: `${p.name || ''} ${p.manager || ''} ${p.location || ''}`.trim(),
      onSelect: () => navigate(`/production/${p.id.slice(0, 8)}-${slugify(p.name)}`),
    })),
    ...visibleMinutes.map(m => ({
      kind: 'minute',
      id: m.id,
      label: m.name || 'Sans nom',
      sub: m.client || '',
      status: null,
      value: `${m.name || ''} ${m.client || ''}`.trim(),
      onSelect: () => navigate(`/chiffrage/${String(m.id).slice(0, 8)}-${slugify(m.name)}`),
    })),
  ];

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);
  const shortcut = isMac ? '⌘K' : 'Ctrl+K';

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Recherche rapide">
      {/* Input */}
      <div className="cmdk-input-wrap">
        <Search size={16} />
        <Command.Input placeholder="Rechercher un projet, chiffrage, écran…" />
      </div>

      {/* Results */}
      <Command.List>
        <Command.Empty>Aucun résultat pour cette recherche.</Command.Empty>

        {/* Navigation */}
        <Command.Group heading="Navigation">
          {allowedNav.map(item => {
            const Icon = item.icon;
            return (
              <Command.Item
                key={item.id}
                value={item.label}
                onSelect={() => run(() => navigate(item.path))}
              >
                <Icon size={15} className="cmdk-item-icon" />
                <span className="cmdk-item-label">{item.label}</span>
                <span className="cmdk-item-kbd">↵</span>
              </Command.Item>
            );
          })}
        </Command.Group>

        {/* Résultats unifiés (projets + chiffrages) triés par pertinence */}
        {results.length > 0 && (
          <Command.Group heading={`Résultats (${results.length})`}>
            {results.map(item => (
              <Command.Item
                key={`${item.kind}-${item.id}`}
                value={item.value}
                onSelect={() => run(item.onSelect)}
              >
                {item.kind === 'project'
                  ? <Layers size={15} className="cmdk-item-icon" />
                  : <FileText size={15} className="cmdk-item-icon" />}
                <span className="cmdk-item-label">{item.label}</span>
                {item.sub && <span className="cmdk-item-badge">{item.sub}</span>}
                {item.kind === 'project' && item.status && (
                  <span className="cmdk-item-badge" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: STATUS_DOT[item.status] || '#9CA3AF',
                      flexShrink: 0,
                    }} />
                    {STATUS_LABEL[item.status] || item.status}
                  </span>
                )}
                <span className="cmdk-item-kbd">{item.kind === 'project' ? 'Production' : 'Ouvrir'}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>

      {/* Footer */}
      <div className="cmdk-footer">
        <span>↑↓ naviguer</span>
        <span><kbd>↵</kbd> ouvrir</span>
        <span><kbd>Esc</kbd> fermer</span>
        <span style={{ marginLeft: 8, opacity: 0.6 }}>{shortcut}</span>
      </div>
    </Command.Dialog>
  );
});

export default CommandPalette;
