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
.wrap{flex:1;display:flex;align-items:center;justify-content:center;padding:24px 16px}
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
