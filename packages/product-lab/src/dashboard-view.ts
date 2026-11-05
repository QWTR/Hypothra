import { inlineJson, style } from "./report.js";
import { dashboardClient } from "./dashboard-client.js";

const extraStyle = `
[hidden]{display:none!important}main{max-width:1120px;padding-top:28px}.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:38px}.brand{font-weight:750;font-size:22px;letter-spacing:-.04em}.brand i{display:inline-block;width:14px;height:14px;border:3px solid var(--accent);border-radius:4px;margin-right:10px;transform:rotate(-12deg)}h1{font-size:clamp(32px,4.6vw,49px);margin:10px 0 12px}.lead{font-size:16px;max-width:690px}.local{font-size:12px;color:var(--good)}.local:before{content:'●';margin-right:7px}.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:28px 0}.step{text-align:left;background:transparent;padding:15px;border:1px solid var(--line);display:flex;align-items:center;gap:10px}.step[aria-current=step]{background:#263040;border-color:var(--accent)}.step b{border:1px solid #47576d;border-radius:50%;width:28px;height:28px;display:grid;place-items:center;font-size:12px;flex-shrink:0}.step[aria-current=step] b{background:var(--accent);color:#18140e;border-color:var(--accent)}.step small{display:block;font-size:11px;color:var(--muted)}.panel{padding:28px;margin-top:8px}.panel-head{display:flex;justify-content:space-between;align-items:start;gap:15px}.panel h2{font-size:25px;letter-spacing:-.02em;margin:2px 0 8px}.panel h3{margin:0 0 8px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.wide{grid-column:1/-1}label.field{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600}label.field small,.help{font-weight:400;font-size:12px;color:var(--muted)}input:not([type=checkbox]),select,textarea{width:100%;min-width:0}textarea{min-height:100px;font:inherit;line-height:1.5}textarea.json{font:12px/1.6 ui-monospace,monospace;min-height:330px}.actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:24px;padding-top:20px;border-top:1px solid var(--line);flex-wrap:wrap}.actions .right,.inline{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.notice{border:1px solid #3e4a5d;border-radius:10px;padding:13px 16px;background:#101a27;font-size:13px;margin:16px 0}.notice.warn{border-color:#665032;background:#221e17}.notice.good{border-color:#315c4e;background:#11251e}.status:empty{display:none}.status{margin:8px 0 18px;padding:12px 16px;border-radius:10px;border:1px solid var(--line);background:#151e2a;font-size:13px}.status.error{color:var(--bad);border-color:#7b443f}.status.success{color:var(--good)}button{font-size:13px;padding:10px 16px}.subcard{border:1px solid var(--line);border-radius:10px;padding:18px;margin:16px 0;background:#101926}.subcard p{font-size:13px}.chips{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 18px}.chip{background:#1f2e41;padding:5px 10px;border-radius:6px;font-size:12px}.tech-row{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin:8px 0}.feature-row{padding:14px 0;border-bottom:1px solid var(--line)}.feature-row input{font-weight:600}.feature-row textarea{min-height:70px;margin-top:7px;font-size:13px}.muted-button{background:transparent}.budget-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:20px 0}.budget-strip>div{background:#0c1420;padding:14px;border-radius:8px}.budget-strip strong{display:block;font-size:21px}.price-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.price{font-size:22px;font-weight:700}.price small{font-size:12px;font-weight:400;color:var(--muted)}.source-card{border:1px solid var(--line);border-radius:10px;padding:16px;margin:12px 0}.source-card label{display:flex;align-items:start;gap:10px;cursor:pointer}.source-card input{width:auto!important;margin-top:7px}.source-card a{font-size:12px}.source-card p{font-size:12px}.source-card.selected{border-color:var(--accent)}.journey{display:grid;grid-template-columns:1fr auto;gap:14px;padding:18px 0;border-bottom:1px solid var(--line)}.journey p{font-size:13px;margin:4px 0}.journey small{color:var(--muted)}.outcome{display:inline-flex;align-items:center;gap:5px;border-radius:20px;padding:3px 10px;background:#233143;font-size:12px;height:fit-content}.result-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.result-grid .card{padding:17px}.result-grid .number{font-size:25px}.step-note{font-size:12px;color:var(--muted)}.summary-line{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:15px}details{margin-top:15px}summary{font-size:13px;color:var(--muted);padding:3px 0}details[open]>summary{margin-bottom:14px}.rate-grid{display:grid;grid-template-columns:2fr repeat(3,1fr);gap:8px;align-items:center;font-size:12px;margin:8px 0}.rate-grid input{padding:8px}.advanced{margin-top:24px}.busy-note{color:var(--accent)}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}footer{margin-top:25px}.panel-head .pill{white-space:nowrap}@media(max-width:700px){.steps{grid-template-columns:1fr 1fr}.form-grid{grid-template-columns:1fr}.wide{grid-column:auto}.result-grid{grid-template-columns:1fr 1fr}.panel{padding:18px}.tech-row{grid-template-columns:1fr}.budget-strip{gap:7px}.budget-strip>div{padding:10px}.budget-strip strong{font-size:17px}.rate-grid{grid-template-columns:1.5fr repeat(3,1fr);gap:4px}.rate-grid input{padding:7px 3px}.topbar{margin-bottom:25px}.step{padding:10px;gap:7px}.step span{font-size:12px}}`;

export function dashboardHtml(token: string): string {
  return `<!doctype html><html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Hypothra · Plan your launch</title><style>${style}\n${extraStyle}\n.budget-strip{grid-template-columns:repeat(3,minmax(0,1fr))}.budget-strip>div{min-width:0}.budget-strip strong{overflow-wrap:anywhere}</style></head>
  <body><main>
    <header><div class="topbar"><div class="brand"><i></i>Hypothra</div><span class="local">Local workspace</span></div>
      <div class="eyebrow">Your product, one step at a time</div><h1>A clearer path to your next launch.</h1>
      <p class="lead">Tell us what you are building, plan your promotion, and check the experience before people arrive.</p>
    </header>
    <nav class="steps" aria-label="Launch setup">
      <button class="step" data-step="0" aria-current="step"><b>1</b><span>Your product<small>Check our understanding</small></span></button>
      <button class="step" data-step="1"><b>2</b><span>Launch plan<small>Budget, audience & ads</small></span></button>
      <button class="step" data-step="2"><b>3</b><span>App checks<small>Try the user experience</small></span></button>
      <button class="step" data-step="3"><b>4</b><span>Your results<small>See what needs attention</small></span></button>
    </nav>
    <div id="status" class="status" role="status" aria-live="polite"></div>

    <section class="panel" data-panel="0">
      <div class="panel-head"><div><div class="eyebrow">Step 1 of 4</div><h2>Does this describe your product?</h2><p>We started with your project files. Correct anything we misunderstood.</p></div><span class="pill" id="state">Loading…</span></div>
      <div id="stack" class="chips"></div>
      <form id="product-form"><div class="form-grid">
        <label class="field">Product name<input id="product-name" required maxlength="180" autocomplete="off"></label>
        <label class="field">Who is it for?<input id="product-audience" required maxlength="4000" placeholder="For example: drivers planning weekend trips"><small>Separate different audiences with a semicolon.</small></label>
        <label class="field wide">What does it do?<textarea id="product-description" required maxlength="4000" placeholder="Explain the app in your own words."></textarea></label>
        <label class="field">Why would someone use it?<textarea id="product-value" required maxlength="4000" placeholder="What problem does it solve?"></textarea></label>
        <label class="field">How will it make money?<textarea id="product-money" required maxlength="4000" placeholder="Subscription, one-off payment, ads, or free."></textarea></label>
      </div>
      <details><summary>Correct the technology stack</summary><div id="technology-fields"></div><button type="button" class="muted-button" id="add-technology">+ Add technology</button></details>
      <details><summary>Review the features we found <span id="feature-count"></span></summary><p class="help">A feature found in code still needs a real app check. You can correct its name and description.</p><div id="feature-fields"></div><button type="button" class="muted-button" id="add-feature">+ Add a feature</button></details>
      <details><summary>Questions to check and source references</summary><ul id="unknowns"></ul><p class="help" id="scan"></p><pre id="evidence"></pre></details>
      <div class="actions"><button type="submit" id="save-product">Save changes</button><div class="right"><span class="step-note" id="approval-note"></span><button type="button" class="primary" id="approve">Looks right — continue</button></div></div>
      </form>
    </section>

    <section class="panel" data-panel="1" hidden>
      <div class="panel-head"><div><div class="eyebrow">Step 2 of 4</div><h2>How do you want to launch?</h2><p>Start with your budget and the promise your ad makes.</p></div></div>
      <form id="launch-form"><div class="form-grid">
        <label class="field wide">Your launch idea<textarea id="launch-idea" required maxlength="4000" placeholder="Describe your campaign or launch plan."></textarea></label>
        <label class="field">Total budget<input id="total-budget" type="number" min="0" max="1000000000" step="0.01" required></label>
        <label class="field">Other launch costs<input id="fixed-costs" type="number" min="0" max="1000000000" step="0.01" required><small>Design, tools, production, or other fixed costs.</small></label>
        <label class="field">Currency<select id="currency"><option>PLN</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
        <label class="field">Where are you launching?<select id="country"><option value="PL">Poland</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="DE">Germany</option><option value="FR">France</option></select></label>
        <label class="field">Monthly subscription price<input id="monthly-price" type="number" min="0" max="1000000" step="0.01" required><small>Use 0 for a free product.</small></label>
        <label class="field">Campaign length (days)<input id="period-days" type="number" min="1" max="365" step="1" required></label>
      </div><div class="budget-strip"><div><span class="label">Ads</span><strong id="budget-ads">—</strong></div><div><span class="label">Other costs</span><strong id="budget-fixed">—</strong></div><div><span class="label">Still available*</span><strong id="budget-left">—</strong></div></div><p class="help">*Before the variable cost of serving new users.</p>
      <div id="channel-fields"></div><button type="button" class="muted-button" id="add-channel">+ Add another ad channel</button>
      <div class="actions"><button type="button" data-step="0">Back</button><div class="right"><button type="submit" id="save-launch">Save launch plan</button><button type="button" class="primary" data-step="2">Continue to app checks</button></div></div></form>
      <div class="subcard"><div class="panel-head"><div><h3>Find ad costs on the web</h3><p>Read published Meta and TikTok benchmarks. No advertising account or API key needed.</p></div><button type="button" id="find-prices">Find published prices</button></div><div id="public-prices"></div></div>
      <details><summary>Edit your own ad cost assumptions</summary><form id="prices-form"><div id="manual-prices"></div><button type="submit">Save cost assumptions</button></form></details>
    </section>

    <section class="panel" data-panel="2" hidden>
      <div class="eyebrow">Step 3 of 4</div><h2>Try the experience your ad promises.</h2><p>These example visitors follow real paths in your local test app. Their motivations are hypotheses; failed steps are observed results.</p>
      <div class="notice" id="test-target"></div><div id="journey-list"></div>
      <div class="actions"><button data-step="1">Back</button><div class="right"><button id="run-checks">Run app checks</button><button class="primary" data-step="3">Continue to results</button></div></div>
      <p class="help">Use a test app with dummy data. Checks can submit forms to the local app. They never buy advertisements.</p>
    </section>

    <section class="panel" data-panel="3" hidden>
      <div class="panel-head"><div><div class="eyebrow">Step 4 of 4</div><h2>What could your launch look like?</h2><p>Explore the assumptions, then see where the tested experience gets in the way.</p></div><select id="result-variant" aria-label="Scenario"><option value="conservative">Cautious</option><option value="central" selected>Expected scenario</option><option value="optimistic">Optimistic</option></select></div>
      <div id="result-notice" class="notice"></div><div id="result-cards" class="result-grid"></div><div id="findings-summary"></div>
      <div class="actions"><button data-step="2">Back</button><div class="right"><label class="inline"><input id="runtime" type="checkbox"> Include the latest app checks</label><button class="primary" id="run">Calculate launch scenario</button><a href="/report" id="report-link" hidden>Open full report →</a></div></div>
      <p class="help">Expected counts can be fractional. This is a scenario based on your assumptions, not a prediction of real customers.</p>
    </section>

    <details class="advanced"><summary>Advanced: inspect or edit JSON</summary><p class="help">Normal setup uses the forms above. These editors expose the complete saved configuration.</p>
      <details><summary>Application model</summary><textarea class="json" id="project" aria-label="Application model JSON" spellcheck="false"></textarea><button id="save-project">Save model JSON</button></details>
      <details><summary>Launch plan</summary><textarea class="json" id="launch" aria-label="Launch plan JSON" spellcheck="false"></textarea><button data-save="launch">Save launch JSON</button></details>
      <details><summary>Ad cost evidence</summary><textarea class="json" id="benchmarks" aria-label="Benchmark JSON" spellcheck="false"></textarea><button data-save="benchmarks">Save evidence JSON</button></details>
      <details><summary>Browser journey definitions</summary><textarea class="json" id="journeys" aria-label="Browser journey JSON" spellcheck="false"></textarea><button data-save="journeys">Save journeys JSON</button></details>
      <p id="revision" class="meta code"></p><button id="reload">Reload saved data / discard edits</button>
    </details>
    <footer>Your work stays in this local project. Public price lookup contacts published sources only when you click it. No ads are purchased or published.</footer>
  </main><script>const token=${inlineJson(token)};(${dashboardClient.toString()})(token);</script></body></html>`;
}
