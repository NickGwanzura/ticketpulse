// Site-wide maintenance mode. Imported by proxy.ts, so it must stay
// Edge-safe: no Node built-ins, no database, no other app imports.
//
// ON by default in production for the 16 Oct 2026 hosting outage (the
// database server is down). Turn it off by setting MAINTENANCE_MODE=off on the
// host and redeploying/restarting. MAINTENANCE_UNTIL (ISO time) sets the
// "expected back" time shown to visitors.

const DEFAULT_UNTIL = "2026-10-16T11:00:00Z" // 13:00 Zimbabwe time, about 4 hours from the outage notice

export function isMaintenanceOn(): boolean {
  const mode = (process.env.MAINTENANCE_MODE ?? "").trim().toLowerCase()
  if (mode === "off" || mode === "false" || mode === "0") return false
  if (mode === "on" || mode === "true" || mode === "1") return true
  return process.env.NODE_ENV === "production"
}

export function maintenanceUntil(): Date {
  const parsed = new Date(process.env.MAINTENANCE_UNTIL ?? DEFAULT_UNTIL)
  return Number.isNaN(parsed.getTime()) ? new Date(DEFAULT_UNTIL) : parsed
}

const ART_SVG = `<svg class="art-svg" viewBox="0 0 480 500" role="img" aria-label="Servers being patched, protected by a shield">
<defs><linearGradient id="rk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a4f8c"/><stop offset="1" stop-color="#143d6b"/></linearGradient></defs>
<g stroke="rgba(255,255,255,.22)" stroke-width="2" stroke-dasharray="4 7" fill="none">
<path d="M330 150 C 400 150, 410 230, 392 300"/><path d="M110 330 C 60 330, 60 420, 140 440"/>
</g>
<rect x="110" y="80" width="220" height="320" rx="20" fill="url(#rk)" stroke="rgba(255,255,255,.14)" stroke-width="2"/>
<g>
<rect x="130" y="102" width="180" height="80" rx="12" fill="#0b2a4d"/>
<rect x="148" y="124" width="70" height="6" rx="3" fill="rgba(255,255,255,.25)"/><rect x="148" y="138" width="54" height="6" rx="3" fill="rgba(255,255,255,.15)"/><rect x="148" y="152" width="62" height="6" rx="3" fill="rgba(255,255,255,.15)"/>
<circle cx="272" cy="142" r="7" fill="#22c55e"/><circle cx="292" cy="142" r="7" fill="rgba(255,255,255,.2)"/>
</g>
<g>
<rect x="130" y="200" width="180" height="80" rx="12" fill="#0b2a4d"/>
<rect x="148" y="222" width="70" height="6" rx="3" fill="rgba(255,255,255,.25)"/><rect x="148" y="236" width="54" height="6" rx="3" fill="rgba(255,255,255,.15)"/><rect x="148" y="250" width="62" height="6" rx="3" fill="rgba(255,255,255,.15)"/>
<circle class="blink" cx="272" cy="240" r="7" fill="#ba4926"/><circle cx="292" cy="240" r="7" fill="rgba(255,255,255,.2)"/>
</g>
<g>
<rect x="130" y="298" width="180" height="80" rx="12" fill="#0b2a4d"/>
<rect x="148" y="320" width="70" height="6" rx="3" fill="rgba(255,255,255,.25)"/><rect x="148" y="334" width="54" height="6" rx="3" fill="rgba(255,255,255,.15)"/><rect x="148" y="348" width="62" height="6" rx="3" fill="rgba(255,255,255,.15)"/>
<circle cx="272" cy="338" r="7" fill="#22c55e"/><circle cx="292" cy="338" r="7" fill="rgba(255,255,255,.2)"/>
</g>
<g class="gear"><circle cx="112" cy="84" r="30" fill="none" stroke="#ba4926" stroke-width="14" stroke-dasharray="8 7.7"/><circle cx="112" cy="84" r="20" fill="#ba4926"/><circle cx="112" cy="84" r="8" fill="#0a2540"/></g>
<g transform="translate(0 6)">
<path d="M352 300 l70 25 v58 c0 50 -32 84 -70 100 c-38 -16 -70 -50 -70 -100 v-58 z" fill="#ba4926" stroke="#0a2540" stroke-width="6"/>
<path d="M322 392 l22 22 l44 -48" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
</g>
</svg>`

const WHATSAPP = "263788689923"
const EMAIL = "nick@spiritusglobal.tech"

export function maintenanceHtml(until: Date): string {
  const untilIso = until.toISOString()
  const untilLabel = until.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Harare" })
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Urgent maintenance · TicketPulse</title>
<meta name="description" content="TicketPulse is paused during urgent, unscheduled upstream maintenance by our EU server provider, to protect the integrity of all data.">
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="refresh" content="300">
<meta name="theme-color" content="#0a2540">
<link rel="icon" href="/ticketpulse-logo.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/Grift-Bold.woff2" as="font" type="font/woff2" crossorigin>
<style>
@font-face{font-family:Grift;src:url(/fonts/Grift-Bold.woff2) format("woff2");font-weight:700;font-display:swap}
@font-face{font-family:Grift;src:url(/fonts/Grift-Black.woff2) format("woff2");font-weight:900;font-display:swap}
@font-face{font-family:Mona;src:url(/fonts/MonaSansVariable.woff2) format("woff2");font-weight:200 900;font-display:swap}
:root{--chrome:#0a2540;--brand:#131132;--accent:#ba4926;--ink:#0a2540;--ink2:#4a5d6e;--ink3:#7a8a99;--line:#e2e8f0;--paper:#fff;--paper2:#f6f9fc;--wa:#25d366}
*{box-sizing:border-box}html,body{margin:0}
body{min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;background:var(--paper2);color:var(--ink);font-family:Mona,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.bar{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;background:var(--chrome);color:#fff;padding:11px 16px;font-size:13px;font-weight:600;text-align:center}
.tag{font-family:Grift,"Arial Narrow",sans-serif;font-weight:900;letter-spacing:.14em;text-transform:uppercase;background:var(--accent);color:#fff;padding:3px 9px;border-radius:6px;font-size:12px}
.split{flex:1;display:grid;grid-template-columns:1fr}
.art{position:relative;display:flex;flex-direction:row;align-items:center;justify-content:center;gap:14px;padding:12px 16px;color:#fff;background:linear-gradient(160deg,#0a2540 0%,#131132 100%);overflow:hidden}
.art::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:40px 40px;pointer-events:none}
.art-svg{position:relative;width:76px;flex:none;height:auto}
.art-cap{position:relative;text-align:left}
.art-cap b{display:block;font-family:Grift,"Arial Narrow",sans-serif;font-weight:900;font-size:15px;letter-spacing:.14em;text-transform:uppercase}
.art-cap span{display:block;margin-top:4px;font-size:13px;color:#b9c6d9}
.blink{animation:p 1.1s ease-in-out infinite}
.gear{transform-box:fill-box;transform-origin:center;animation:spin 8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.blink,.gear{animation:none}}
@media (min-width:960px){.split{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.art{flex-direction:column;gap:10px;padding:48px}.art-cap{text-align:center}.art-svg{width:100%;max-width:440px}.art-cap b{font-size:18px}.art-cap span{font-size:15px}}
.wrap{display:flex;align-items:center;justify-content:center;padding:24px 16px}
main{width:100%;max-width:560px;background:var(--paper);border:1px solid var(--line);border-top:4px solid var(--accent);border-radius:20px;padding:28px 22px;box-shadow:0 24px 60px -32px rgba(10,37,64,.35)}
.logo{display:block;width:120px;height:auto;margin:-14px 0 0 -10px}
.pill{display:inline-flex;align-items:center;gap:8px;font-family:Grift,"Arial Narrow",sans-serif;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8a3416;background:#fdf1ec;border:1px solid #f3cbb9;padding:6px 10px;border-radius:999px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--accent);animation:p 1.4s ease-in-out infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.3}}@media (prefers-reduced-motion:reduce){.dot{animation:none}}
h1{margin:16px 0 12px;font-family:Grift,"Arial Narrow",sans-serif;font-weight:900;font-size:32px;line-height:1.05;letter-spacing:-.01em;color:var(--brand)}
p{margin:0 0 14px;font-size:16px;line-height:1.55;color:var(--ink2)}
p strong{color:var(--ink)}
.eta{margin:20px 0;padding:18px 16px;border-radius:14px;background:var(--chrome);color:#fff;text-align:center}
.eta small{display:block;font-family:Grift,"Arial Narrow",sans-serif;font-weight:700;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#b9c6d9;margin-bottom:6px}
.eta strong{display:block;font-family:Grift,"Arial Narrow",sans-serif;font-weight:900;font-size:40px;font-variant-numeric:tabular-nums;line-height:1.1}
.eta span{display:block;margin-top:6px;font-size:14px;color:#d6dfeb}
.card{margin:16px 0;padding:16px;border-radius:14px;background:var(--paper2);border:1px solid var(--line)}
.card b{display:block;margin-bottom:4px;color:var(--ink);font-size:15px}.card p{margin:0;font-size:15px}
.actions{display:grid;gap:10px;margin-top:18px}
.btn{display:flex;align-items:center;justify-content:center;min-height:50px;padding:0 18px;border-radius:12px;font-family:Grift,"Arial Narrow",sans-serif;font-weight:700;font-size:15px;letter-spacing:.08em;text-transform:uppercase;text-decoration:none}
.wa{background:var(--wa);color:#052e16}.mail{background:var(--paper);color:var(--ink);border:1px solid var(--line)}
.btn:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.foot{margin-top:18px;font-size:13px;color:var(--ink3);text-align:center}
@media (min-width:480px){main{padding:36px 34px}h1{font-size:38px}}
</style>
</head>
<body>
<div class="bar" role="alert"><span class="tag">Urgent</span> Unscheduled upstream maintenance by our EU server provider</div>
<div class="split">
<aside class="art" aria-hidden="false">${ART_SVG}<div class="art-cap"><b>Protecting your data</b><span>Upstream server patch in progress</span></div></aside>
<div class="wrap"><main>
<img class="logo" src="/ticketpulse-logo.svg" alt="TicketPulse" width="120" height="120">
<span class="pill"><span class="dot" aria-hidden="true"></span> Urgent maintenance</span>
<h1>Urgent maintenance in progress</h1>
<p>Our server provider in the EU is applying an <strong>urgent, unscheduled upstream maintenance patch</strong>. It could not be postponed or moved to another time.</p>
<p>To protect the <strong>integrity of all orders, tickets and account data</strong>, we have paused TicketPulse until the patch is complete. Ticket sales, accounts and dashboards will be back as soon as it is done.</p>
<div class="eta" aria-live="polite">
<small>Expected back in about</small>
<strong id="tp-countdown">4 hours</strong>
<span id="tp-eta">Around ${untilLabel} (Zimbabwe time)</span>
</div>
<div class="card"><b>Already bought a ticket?</b><p>Your ticket is safe. Keep your confirmation email and ticket PDF. Nothing you have already paid for is lost.</p></div>
<p>Need help right now? Message us and we'll reply as soon as we can.</p>
<div class="actions">
<a class="btn wa" href="https://wa.me/${WHATSAPP}?text=Hi%20TicketPulse%2C%20I%20need%20help%20during%20the%20maintenance." rel="noopener">WhatsApp support</a>
<a class="btn mail" href="mailto:${EMAIL}?subject=TicketPulse%20help">Email us</a>
</div>
<p class="foot">We're sorry for the disruption. This page refreshes itself every 5 minutes.</p>
</main></div>
</div>
<script>
(function(){
  var until=new Date(${JSON.stringify(untilIso)}).getTime();
  var el=document.getElementById("tp-countdown"), eta=document.getElementById("tp-eta");
  function tick(){
    var ms=until-Date.now();
    if(ms<=0){el.textContent="Any moment now";eta.textContent="The patch is taking a little longer than expected. Thank you for your patience.";return}
    var h=Math.floor(ms/3600000), m=Math.floor(ms%3600000/60000), s=Math.floor(ms%60000/1000);
    el.textContent=(h>0?h+"h ":"")+(m<10&&h>0?"0":"")+m+"m "+(s<10?"0":"")+s+"s";
  }
  tick();setInterval(tick,1000);
})();
</script>
</body>
</html>`
}
