// src/components/ScreenErrorBoundary.jsx
// Filet de sécurité PAR ÉCRAN : si un écran plante (erreur de rendu), seul cet écran
// est remplacé par un message — l'en-tête, la navigation et les autres écrans restent
// utilisables. Avant, l'unique ErrorBoundary racine remplaçait TOUTE l'application.
// Réinitialisé à chaque navigation (prop `resetKey`).
import React from "react";

export default class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) { console.error("Écran planté :", error, info?.componentStack); }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: 12, padding: 16, color: '#6B7280', fontFamily: 'system-ui' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Cet écran a rencontré une erreur</div>
        <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 440 }}>
          Les données déjà enregistrées ne sont pas affectées. Vous pouvez réessayer ou revenir en arrière.
        </div>
        <details style={{ fontSize: 12, maxWidth: 560 }}>
          <summary style={{ cursor: 'pointer' }}>Détail technique</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error?.message || this.state.error)}</pre>
        </details>
        <div style={{ display: 'flex', gap: 8 }}>
          {this.props.onBack && (
            <button onClick={() => { this.setState({ error: null }); this.props.onBack(); }} style={{ background: '#F3F4F6', color: '#111827', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Retour</button>
          )}
          <button onClick={() => this.setState({ error: null })} style={{ background: '#1E2447', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Réessayer</button>
        </div>
      </div>
    );
  }
}
