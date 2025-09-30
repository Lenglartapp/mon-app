// src/components/Require.jsx
import React from "react";
import { useAuth } from "../auth";
import { can } from "../lib/authz";

/**
 * <Require perm="production.view"> ... </Require>
 * (alias: action="production.view")
 */
export default function Require({ perm, action, children, fallback = null, style }) {
  const { currentUser } = useAuth();
  const needed = perm || action; // supporte les deux noms de props

  if (!needed) {
    // Si aucune permission n’est fournie, on laisse passer (ou tu peux décider de bloquer)
    return <>{children}</>;
  }

  if (!can(currentUser, needed)) {
    return (
      fallback ?? (
        <div
          style={{
            padding: 16,
            color: "#b91c1c",
            fontWeight: 600,
            border: "1px solid #fee2e2",
            background: "#fef2f2",
            borderRadius: 8,
            ...style,
          }}
        >
          Accès refusé — vous n’avez pas les autorisations nécessaires.
        </div>
      )
    );
  }

  return <>{children}</>;
}