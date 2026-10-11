// Libellés des rôles (clés de lib/authz.js) et pastille du nuancier (Paramètres).
export const ROLE_INFO = {
  admin: { label: "Administrateur", tone: 0 },
  sales: { label: "Commercial", tone: 1 },
  ordo: { label: "Ordonnancement", tone: 2 },
  ordo_conf: { label: "Ordonnancement · confection", tone: 2 },
  op: { label: "Opérateur", tone: 3 },
  prepa: { label: "Préparation", tone: 4 },
  pose: { label: "Pose", tone: 4 },
  conf: { label: "Confection", tone: 4 },
  compta: { label: "Comptabilité", tone: 5 },
};
export const roleOf = (role) => ROLE_INFO[role] || { label: role || "—", tone: null };
