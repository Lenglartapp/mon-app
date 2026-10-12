// src/lib/quoteValidation.js
// -----------------------------------------------------------------------------
// Circuit de validation des devis (chiffrages) — règles validées avec la direction :
//   - « À valider » : tout le monde peut le demander → notification aux valideurs ;
//   - « Validée » / « À reprendre » : réservés aux VALIDEURS (Adrien, Aristide).
//     La validation fige dans l'historique le MONTANT validé ; « À reprendre »
//     exige un motif. Le demandeur est notifié ;
//   - un devis validé reste modifiable, mais s'il change de prix il repasse
//     « En cours » (ChiffrageScreen) : il faut redemander la validation ;
//   - « Commande » / « Commande terminée » : devis figé ; seuls les administrateurs
//     peuvent en changer le statut ;
//   - « Perdu » / « Commande terminée » : archivés (masqués de la liste).
// La trace vit dans `minute.modules.validation` et `minute.modules.history`.
// -----------------------------------------------------------------------------

import { buildStatusLog } from './minuteHistory.js';

// Valideurs : prénoms (profil actif). Liste courte et volontairement nominative.
export const VALIDATOR_FIRST_NAMES = ['adrien', 'aristide'];

const normName = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const firstName = (u) => normName(u?.first_name || String(u?.name || '').split(/\s+/)[0]);

export const isValidator = (user) => !!user && VALIDATOR_FIRST_NAMES.includes(firstName(user));
export const validatorsOf = (users) => (users || []).filter((u) => !u.archived_at && isValidator(u));

export const FROZEN_STATUSES = ['ORDERED', 'ORDER_COMPLETED'];
export const isFrozen = (status) => FROZEN_STATUSES.includes(status);
const VALIDATOR_ONLY = ['VALIDATED', 'REVISE'];

/** L'utilisateur peut-il passer le devis de `from` à `to` ? Renvoie null si oui, sinon la raison. */
export function statusChangeBlocked(user, from, to) {
  if (from === to) return null;
  if (isFrozen(from) && user?.role !== 'admin') return 'Devis en commande : seul un administrateur peut changer son statut.';
  if (VALIDATOR_ONLY.includes(to) && !isValidator(user)) return 'Seuls Adrien et Aristide peuvent valider ou mettre un devis « À reprendre ».';
  return null;
}

/** Statuts non proposés à cet utilisateur dans le menu (le statut actuel reste affiché). */
export function disabledStatuses(user, from, allStatuses) {
  return allStatuses.filter((s) => s !== from && statusChangeBlocked(user, from, s));
}

/** Le changement demande-t-il une fenêtre (confirmation du montant, motif) ? */
export const needsDialog = (to) => to === 'VALIDATED' || to === 'REVISE' || to === 'PENDING_APPROVAL';

const eur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtH = (n) => `${(Math.round((Number(n) || 0) * 10) / 10).toLocaleString('fr-FR')} h`;

let seq = 0;
const entry = (fields, author) => ({
  id: `${Date.now()}-val-${seq++}`, author, date: Date.now(), createdAt: new Date().toISOString(), context: 'Validation', ...fields,
});

/**
 * Prépare un changement de statut : `modules` à enregistrer (historique + trace de
 * validation) et notifications à envoyer.
 *   minute : { id, name, status, modules }
 *   figures : { ca, achats, heures, lignes } — montants au moment du changement
 */
export function buildStatusChange({ minute, to, user, users, figures = {}, comment = '' }) {
  const from = minute?.status || 'DRAFT';
  const author = user?.name || user?.email || 'Utilisateur';
  const now = new Date().toISOString();
  const prevValidation = minute?.modules?.validation || {};
  const validation = { ...prevValidation };
  const history = [buildStatusLog(from, to, author)];
  const notifications = [];
  const note = String(comment || '').trim();
  const action = { screen: 'chiffrage', id: minute?.id };
  const name = minute?.name || 'Devis';

  if (to === 'PENDING_APPROVAL') {
    validation.request = { by: { id: user?.id, name: author }, at: now, ca: figures.ca ?? null, comment: note || null };
    history.push(entry({ type: 'log', field: 'Demande de validation', from: '—', to: `${eur(figures.ca)} HT` }, author));
    if (note) history.push(entry({ type: 'msg', text: note }, author));
    validatorsOf(users).filter((u) => u.id !== user?.id).forEach((u) => notifications.push({
      userId: u.id, type: 'warning', action,
      title: 'Devis à valider',
      message: `${author} demande la validation de « ${name} » (${eur(figures.ca)} HT)${note ? ` : ${note}` : ''}`,
    }));
  }

  if (to === 'VALIDATED' || to === 'REVISE') {
    const requester = prevValidation.request?.by;
    const decision = {
      status: to, by: { id: user?.id, name: author }, at: now, comment: note || null,
      ca: figures.ca ?? null, achats: figures.achats ?? null, heures: figures.heures ?? null, lignes: figures.lignes ?? null,
    };
    validation.decision = decision;
    if (to === 'VALIDATED') {
      validation.validated = decision;
      history.push(entry({ type: 'log', field: 'Montant validé', from: '—', to: `${eur(figures.ca)} HT` }, author));
      if (figures.heures != null || figures.achats != null) {
        history.push(entry({ type: 'log', field: 'Détail au moment de la validation', from: '—', to: [
          figures.achats != null ? `achats ${eur(figures.achats)}` : null,
          figures.heures != null ? fmtH(figures.heures) : null,
          figures.lignes != null ? `${figures.lignes} ligne(s)` : null,
        ].filter(Boolean).join(' · ') }, author));
      }
    }
    if (note) history.push(entry({ type: 'msg', text: note }, author));
    if (requester?.id && requester.id !== user?.id) {
      notifications.push({
        userId: requester.id, action,
        type: to === 'VALIDATED' ? 'success' : 'error',
        title: to === 'VALIDATED' ? 'Devis validé' : 'Devis à reprendre',
        message: to === 'VALIDATED'
          ? `${author} a validé « ${name} » à ${eur(figures.ca)} HT${note ? ` : ${note}` : ''}`
          : `${author} demande de reprendre « ${name} » : ${note}`,
      });
    }
  }

  return { from, history, validation, notifications };
}

/**
 * Devis validé dont le prix a changé depuis : entrées d'historique du retour
 * automatique en « En cours ». null si rien à faire.
 */
export function buildInvalidation({ minute, currentCa, user }) {
  const validated = minute?.modules?.validation?.validated;
  if (minute?.status !== 'VALIDATED' || validated?.ca == null) return null;
  if (Math.abs(Number(currentCa) - Number(validated.ca)) < 1) return null;
  const author = user?.name || user?.email || 'Utilisateur';
  return {
    status: 'IN_PROGRESS',
    history: [
      buildStatusLog('VALIDATED', 'IN_PROGRESS', author),
      entry({ type: 'log', field: 'Modifié après validation', from: `${eur(validated.ca)} HT (validé)`, to: `${eur(currentCa)} HT` }, author),
    ],
  };
}
