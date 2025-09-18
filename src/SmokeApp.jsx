// src/SmokeApp.jsx
import React, { useState } from "react";

export default function SmokeApp(){
  const [screen, setScreen] = useState("home");
  return (
    <div style={{ padding:20, fontFamily:"system-ui" }}>
      <h1>Smoke Test</h1>
      <div style={{display:"flex", gap:10, margin:"10px 0"}}>
        <button onClick={()=>setScreen("home")}>Accueil</button>
        <button onClick={()=>setScreen("production")}>Production</button>
        <button onClick={()=>setScreen("planning")}>Planning</button>
        <button onClick={()=>setScreen("interne")}>Interne</button>
      </div>
      <div style={{padding:12, border:"1px solid #ddd", borderRadius:8}}>
        {screen === "home" && <div>Écran Accueil (OK)</div>}
        {screen === "production" && <div>Écran Production (placeholder)</div>}
        {screen === "planning" && <div>Écran Planning (placeholder)</div>}
        {screen === "interne" && <div>Écran Interne (placeholder)</div>}
      </div>
    </div>
  );
}