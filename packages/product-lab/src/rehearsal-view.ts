export function rehearsalSetupHtml() {
  return `<div class="notice good"><strong>A virtual premiere, driven by AI</strong><p>AI proposes the audience, reel script and launch costs. Each simulated person then makes an individual decision, with a saved reason. No conversion-rate form is required.</p></div>
  <form id="virtual-prepare-form"><div class="form-grid">
    <label class="field wide">Reel script, ad concept or optional launch idea<textarea id="virtual-idea" maxlength="8000" placeholder="Leave this empty and AI will propose a creative from your product. You can edit it before the audience sees it."></textarea></label>
    <label class="field wide">Your constraints (optional)<textarea id="virtual-constraints" maxlength="4000" placeholder="For example: budget up to 2,000 PLN, launch in Poland, no subscription. Leave empty for an AI proposal."></textarea></label>
    <label class="field">Virtual audience size<select id="virtual-viewers"><option value="20">20 people · pilot</option><option value="1000">1,000 people</option><option value="50000">50,000 people</option><option value="100000">100,000 people</option></select></label>
    <label class="field">Planning currency<select id="virtual-currency"><option>PLN</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
    <label class="field">AI request limit<input id="virtual-call-limit" type="number" min="2" max="200000" step="1" value="100" required><small>A hard stop for this run. One request may evaluate up to 10 people. Browser visitors need several additional requests each.</small></label>
    </div><p class="help">Uses your configured AI account. Large audiences take many model calls and can consume substantial account usage. Start with the pilot. These are synthetic judgments, not measured customer conversions.</p>
    <button class="primary" id="virtual-prepare" type="submit">Let AI prepare my virtual launch</button></form>
    <div id="virtual-message" class="notice">AI will fill the plan. Review it, then choose when to start.</div>
    <p id="virtual-empty" class="help">Your AI launch plan will appear here.</p>
    <div id="virtual-progress" hidden><h3 id="virtual-run-status"></h3><p id="virtual-progress-text"></p><progress id="virtual-progress-bar" style="width:100%" max="20" value="0"></progress>
      <div id="virtual-counts" class="result-grid"></div><p id="virtual-rates" class="help"></p><p id="virtual-usage" class="help"></p>
      <div id="virtual-plan" class="subcard" style="display:grid;gap:10px"></div><div id="virtual-cost-sources"></div>
      <div class="toolbar"><button id="virtual-save-plan" type="button">Save plan corrections</button><button id="virtual-start" class="primary" type="button">Start / resume AI audience</button><button id="virtual-pause" type="button">Pause after current batch</button></div>
      <p class="help">Only completed individual records count. No multiplication of a pilot result into a larger audience. Shared model calls can create correlated responses; a bigger cohort does not prove accuracy.</p>
      <button id="virtual-sample-button" type="button" hidden>Inspect individual decisions</button><div id="virtual-records"></div><div class="toolbar"><button id="virtual-prev" type="button" disabled>Previous batch</button><button id="virtual-next" type="button" disabled>Next batch</button></div>
      <details><summary>Edit the complete AI plan</summary><textarea id="virtual-plan-json" class="json" aria-label="AI launch plan JSON"></textarea><button id="virtual-save-json" type="button">Save full AI plan</button></details>
      <details><summary>What this rehearsal can and cannot establish</summary><ul id="virtual-limitations"></ul></details>
    </div>`;
}

export function rehearsalAppHtml() {
  return `<h3>Let interested AI visitors explore the app</h3><p id="virtual-app-summary"></p>
    <form id="virtual-app-form"><div class="form-grid"><label class="field">Local test app address<input id="virtual-test-url" type="url" placeholder="http://127.0.0.1:3000/" required></label>
      <label class="field">Maximum AI browser visitors<input id="virtual-test-users" type="number" min="1" max="5000" value="5" step="1" required><small>Capped at people who individually chose to try the app.</small></label></div>
      <label class="inline" style="margin:16px 0"><input id="virtual-test-consent" type="checkbox" required>This local app uses synthetic test data and has no live payments, messages or production services.</label>
      <button class="primary" id="virtual-app-start" type="submit">Explore with interested AI visitors</button></form>
      <p class="help">Each visitor opens a fresh browser, reads actual page content, chooses actions and gives feedback. Browser observations are kept separate from the AI's opinions. This is not a concurrent load test. If the AI request limit is reached, raise it in step 2 and resume the saved run.</p>
      <div id="virtual-app-counts" class="result-grid"></div><div id="virtual-experiences"></div>`;
}

export function rehearsalResultsHtml() {
  return `<div class="notice good">The AI rehearsal recommends changes using saved viewer decisions and actual local browser observations. Finish the audience in step 2; add app exploration in step 3 when your test app is ready.</div><div id="virtual-optimization"></div><button id="virtual-history-button" type="button">Compare saved launch runs</button><div id="virtual-history"></div>`;
}
