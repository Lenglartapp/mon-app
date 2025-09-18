// src/ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state = { error: null, info: null };
  }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(error, info){ console.error("UI crash:", error, info); this.setState({ info }); }

  render(){
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ padding:20, fontFamily:"system-ui" }}>
        <h2>Oups, un écran a planté 🚧</h2>
        <p style={{opacity:.7}}>L’app reste affichée pour débogage.</p>
        <details open style={{marginTop:8}}>
          <summary>Stack (composants)</summary>
          <pre style={{whiteSpace:"pre-wrap", background:"#fff7ed", border:"1px solid #fed7aa", padding:12, borderRadius:8}}>
{String(this.state.error?.message || this.state.error)}
{"\n"}
{this.state.info?.componentStack || ""}
          </pre>
        </details>
        <button onClick={()=>location.reload()} style={{marginTop:12, padding:"8px 12px"}}>Recharger</button>
      </div>
    );
  }
}