import React, { useEffect, useState } from "react";

export default function LightboxModal({ images, index, onClose, onPrev, onNext }) {
  const [i, setI] = useState(index || 0);
  const n = images?.length || 0;

  useEffect(() => setI(index || 0), [index]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  if (!n) return null;
  const src = images[i];

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.7)",
        display: "grid", placeItems: "center", zIndex: 999
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative", width: "min(92vw, 1200px)", height: "min(92vh, 800px)",
          background: "#000", borderRadius: 12, overflow: "hidden", boxShadow: "0 22px 48px rgba(0,0,0,.4)"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
        />

        {/* Fermeture */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 10, right: 10,
            background: "rgba(0,0,0,.6)", color: "#fff",
            border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer"
          }}
        >Fermer (Esc)</button>

        {/* Prev / Next */}
        {n > 1 && (
          <>
            <button
              onClick={onPrev}
              style={{
                position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                background: "rgba(0,0,0,.6)", color: "#fff",
                border: "none", borderRadius: 999, width: 42, height: 42, cursor: "pointer", fontSize: 18
              }}
              title="Précédent (←)"
            >‹</button>
            <button
              onClick={onNext}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "rgba(0,0,0,.6)", color: "#fff",
                border: "none", borderRadius: 999, width: 42, height: 42, cursor: "pointer", fontSize: 18
              }}
              title="Suivant (→)"
            >›</button>

            {/* Compteur */}
            <div
              style={{
                position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
                background: "rgba(0,0,0,.6)", color: "#fff",
                borderRadius: 999, padding: "6px 10px", fontSize: 12
              }}
            >
              {i + 1} / {n}
            </div>
          </>
        )}
      </div>
    </div>
  );
}