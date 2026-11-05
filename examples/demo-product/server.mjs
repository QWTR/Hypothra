import { createServer } from "node:http";

export async function startDemoApp(port = 4179) {
  const routes = new Map();
  const app = {
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
  };
  app.get("/", (_request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Trailboard test product</title><style>body{font:18px system-ui;background:#f1f3f0;color:#1d3027;padding:7vw;max-width:850px}h1{font-size:clamp(34px,6vw,65px)}button,input{font:inherit;padding:12px;border:1px solid #536b5b;border-radius:8px;margin:6px 0}button{cursor:pointer;background:#244e38;color:white}section{padding:20px 0;border-top:1px solid #cad4cb}label{display:block}small{display:block;color:#59655d}#mobile-signup{display:none}@media(max-width:600px){#desktop-signup{display:none}#mobile-signup{display:inline-block}}</style></head><body><small>HYPOTHRA SYNTHETIC TEST PRODUCT</small><h1>Find a route.<br>Make it yours.</h1><p>Plan your next drive and keep your favorite routes together.</p><section><h2>Create a test account</h2><label>Test email <input id="email" type="email" placeholder="tester@example.invalid"></label><button id="desktop-signup">Create account</button><button id="mobile-signup">Create account</button><p id="signup-status" role="status">Not registered</p></section><section><h2>Save your first route</h2><input id="route-name" aria-label="Route name" placeholder="Weekend route"><button id="save-route">Save route</button><p id="route-status">No saved route</p></section><section><h2>Location is optional</h2><button id="location">Use location</button><p id="location-status">Manual entry available</p></section><section><h2>Premium · 19 PLN / month</h2><p>This is a mock purchase screen. It never charges money.</p><button id="premium">Try test checkout</button><p id="payment-status">No payment</p></section><script>document.querySelector('#desktop-signup').onclick=async()=>{const response=await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.querySelector('#email').value})});if(response.ok)document.querySelector('#signup-status').textContent='Account created';};document.querySelector('#save-route').onclick=async()=>{const response=await fetch('/api/routes',{method:'POST'});if(response.ok)document.querySelector('#route-status').textContent='Route saved';};document.querySelector('#location').onclick=()=>{navigator.geolocation.getCurrentPosition(()=>document.querySelector('#location-status').textContent='Synthetic location accepted',()=>document.querySelector('#location-status').textContent='Location denied. Enter your route manually.');};document.querySelector('#premium').onclick=()=>document.querySelector('#payment-status').textContent='Test checkout complete. No charge.';</script></body></html>`);
  });
  app.post("/api/signup", (_request, response) => { response.setHeader("Content-Type", "application/json"); response.end('{"created":true,"synthetic":true}'); });
  app.post("/api/routes", (_request, response) => { response.setHeader("Content-Type", "application/json"); response.end('{"saved":true,"synthetic":true}'); });
  app.get("/redirect", (_request, response) => { response.writeHead(302, { Location: "https://example.com/blocked" }); response.end(); });
  const server = createServer((request, response) => {
    const handler = routes.get(`${request.method} ${new URL(request.url, "http://127.0.0.1").pathname}`);
    if (!handler) { response.writeHead(404); response.end("Not found"); return; }
    handler(request, response);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}
