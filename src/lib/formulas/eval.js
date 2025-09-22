// src/lib/formulas/eval.js
export function evalFormula(expr, row){
  if(!expr) return "";
  const js = String(expr).replace(/\{([^}]+)\}/g, (_,name)=>`get('${norm(name)}')`);
  const get = (k)=>{ const v=row[k]; const n=toNumber(v); return (typeof v==="number" || (String(v).trim()!=="" && Number.isFinite(n)))? n : v; };
  const ROUND=(x,n=0)=>{ const p=10**n; return Math.round((toNumber(x))*p)/p; };
  const IF=(cond,a,b)=>(cond?a:b);
  const MIN=(...xs)=>Math.min(...xs.map(toNumber));
  const MAX=(...xs)=>Math.max(...xs.map(toNumber));
  const ROUNDUP=(x)=>Math.ceil(toNumber(x));
  try{ const fn = new Function("get","ROUND","IF","MIN","MAX","ROUNDUP", `return (${js});`); return fn(get,ROUND,IF,MIN,MAX,ROUNDUP); } catch{ return "#ERR"; }
}