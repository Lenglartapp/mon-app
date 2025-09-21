import { useEffect, useState } from "react";

export function useViewportWidth() {
  const [w, setW] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 0
  );
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}