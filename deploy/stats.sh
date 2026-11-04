#!/bin/bash
# Besucherstatistik aus dem Caddy-Log (ohne IP-Adressen): Seitenaufrufe, Herkunft (utm_source/Referer) und Weg bis zur Registrierung.
# Aufruf auf dem Server: bash /opt/fallflow/current/deploy/stats.sh [Stunden, Standard 24]
HOURS="${1:-24}"
cat /var/log/caddy/fallflow-access*.log 2>/dev/null | HOURS="$HOURS" node -e '
const since = Date.now() / 1000 - Number(process.env.HOURS) * 3600;
const bot = /bot|crawl|spider|slurp|facebookexternalhit|preview|curl|wget|python|go-http|headless|scan|monitor/i;
const views = [], src = {}, paths = {}, refs = {}, funnel = { "/": 0, "/preise": 0, "/signup": 0, "/onboarding": 0, "/dashboard": 0 };
let lines = 0;
for (const line of require("fs").readFileSync(0, "utf8").split("\n")) {
  if (!line) continue; let e; try { e = JSON.parse(line); } catch { continue; }
  if (e.ts < since || !e.request) continue; lines++;
  const r = e.request, ua = (r.headers?.["User-Agent"] || [""])[0];
  if (r.method !== "GET" || e.status >= 400 || bot.test(ua)) continue;
  const url = new URL(r.uri, "https://fallflow.eu"); const p = url.pathname;
  if (/^\/(_next|api|favicon|icon|apple-touch|manifest|robots|sitemap|opengraph|brand|videos|widget)/.test(p) || /\.[a-z0-9]{2,5}$/i.test(p)) continue;
  if ((r.headers?.["Next-Router-Prefetch"] || r.headers?.["Rsc"]) && !url.searchParams.has("utm_source")) continue; // Hintergrund-Abrufe der App, keine echten Seitenaufrufe
  views.push(p); paths[p] = (paths[p] || 0) + 1;
  const s = url.searchParams.get("utm_source"); if (s) { const k = s + (url.searchParams.get("utm_campaign") ? " / " + url.searchParams.get("utm_campaign") : ""); src[k] = (src[k] || 0) + 1; }
  const ref = (r.headers?.["Referer"] || [""])[0]; if (ref && !ref.includes("fallflow.eu")) { const h = new URL(ref).hostname; refs[h] = (refs[h] || 0) + 1; }
  for (const f of Object.keys(funnel)) if (p === f || (f !== "/" && p.startsWith(f + "/"))) funnel[f]++;
}
const top = (o, n = 12) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `  ${String(v).padStart(5)}  ${k}`).join("\n") || "  –";
console.log(`Letzte ${process.env.HOURS} Stunden – ${views.length} Seitenaufrufe (ohne Bots und Dateien, ${lines} Log-Zeilen)\n`);
console.log("Ankünfte aus Werbung (utm_source / Kampagne):\n" + top(src));
console.log("\nVerweisende Seiten:\n" + top(refs));
console.log("\nMeistbesuchte Seiten:\n" + top(paths));
console.log("\nWeg zur Registrierung (Aufrufe):\n" + Object.entries(funnel).map(([k, v]) => `  ${String(v).padStart(5)}  ${k}`).join("\n"));
'
