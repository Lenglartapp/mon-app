import React, { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { fetchProjectStatus, odooProjectUrl } from "../../lib/odoo/odooPreviewClient";
import { getOdooId } from "../../lib/odoo/odooMapping";

// Petit encart "Statut Odoo" à poser à droite d'un titre de bloc (ex. Consommation Temps).
// Interroge /api/odoo/project-status. En dev local (fonctions /api non servies), affiche
// un état neutre "indisponible" sans erreur bloquante.

const MAP = {
  linked:        { label: "Connecté à Odoo", dot: "#10B981", color: "#047857" },
  ambiguous:     { label: "À confirmer",     dot: "#F59E0B", color: "#B45309" },
  pending_tasks: { label: "Non connecté",    dot: "#9CA3AF", color: "#6B7280" },
  not_found:     { label: "Non connecté",    dot: "#9CA3AF", color: "#6B7280" },
};

function Chip({ dot, color, label, icon = false, title }) {
  return (
    <span
      title={title}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color, whiteSpace: "nowrap" }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      {label}
      {icon && <ExternalLink size={12} />}
    </span>
  );
}

export default function OdooStatusBadge({ projectName, projectId = null, odooProjectId = null }) {
  const [state, setState] = useState({ loading: true });
  const effectiveOdooId = odooProjectId || getOdooId(projectId);

  useEffect(() => {
    let alive = true;
    if (!projectName && !effectiveOdooId) {
      setState({ loading: false, unavailable: true });
      return;
    }
    setState({ loading: true });
    fetchProjectStatus(projectName, effectiveOdooId)
      .then((r) => alive && setState({ loading: false, ...r }))
      .catch(() => alive && setState({ loading: false, unavailable: true }));
    return () => { alive = false; };
  }, [projectName, effectiveOdooId]);

  if (state.loading) return <Chip dot="#D1D5DB" color="#9CA3AF" label="Odoo…" />;

  if (state.unavailable) {
    return (
      <Chip
        dot="#D1D5DB"
        color="#9CA3AF"
        label="Statut Odoo —"
        title="Statut indisponible en local (nécessite un déploiement Vercel)."
      />
    );
  }

  const m = MAP[state.status] || MAP.not_found;

  if (state.status === "linked" && state.project) {
    return (
      <a href={odooProjectUrl(state.project.id)} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }} title={`Ouvrir le projet #${state.project.id} dans Odoo`}>
        <Chip dot={m.dot} color={m.color} label={m.label} icon />
      </a>
    );
  }

  if (state.status === "ambiguous") {
    return <Chip dot={m.dot} color={m.color} label={m.label} title={`Plusieurs projets Odoo de ce nom (${(state.candidates || []).map((c) => "#" + c.id).join(", ")}).`} />;
  }

  return <Chip dot={m.dot} color={m.color} label={m.label} title={state.status === "pending_tasks" ? "Projet Odoo trouvé mais tâches Conf/Prépa/Pose non créées (devis non confirmé ?)." : "Aucun projet Odoo correspondant."} />;
}
