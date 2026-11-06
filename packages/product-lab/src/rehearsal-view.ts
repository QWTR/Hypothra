const spark = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

export function rehearsalSetupHtml() {
  return `<details id="virtual-brief-settings" class="campaign-settings" open><summary id="virtual-brief-summary">Your campaign idea</summary>
    <form id="virtual-prepare-form" class="launch-setup"><div class="setup-topline"><h3>What should people discover?</h3><span class="setup-icon" aria-hidden="true">✧</span></div>
      <label class="field">Reel script, ad concept or optional launch idea<textarea id="virtual-idea" maxlength="8000" placeholder="Tell us about your ad. Or leave this blank — AI will suggest an idea from your product."></textarea></label>
      <div class="audience-picker" style="margin-top:20px"><label class="field">Virtual audience size<select id="virtual-viewers" aria-label="Virtual audience size"><option value="20">20 people · a quick pilot</option><option value="1000">1,000 people</option><option value="50000">50,000 people</option><option value="100000">100,000 people</option></select></label><p class="help">Start small. See the reasons behind each reaction before scaling up.</p></div>
      <details><summary>Budget, preferences & AI limits <span class="optional-badge">optional</span></summary><div class="form-grid detail-body">
        <label class="field wide">Your constraints (optional)<textarea id="virtual-constraints" maxlength="4000" placeholder="For example: launch in Poland, budget up to 2,000 PLN, no subscription."></textarea></label>
        <label class="field">Planning currency<select id="virtual-currency" aria-label="Planning currency"><option>PLN</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
        <label class="field">AI request limit<input id="virtual-call-limit" aria-label="AI request limit" type="number" min="2" max="200000" step="1" value="100" required><small>A hard stop. Large audiences and browser visits use more of your AI account.</small></label>
      </div></details>
      <div class="setup-footer"><p class="help">AI will propose the creative, audience and cost estimates. You review the plan before it runs.</p><button class="primary" id="virtual-prepare" type="submit">Build my launch plan</button></div>
    </form></details>
    <div id="virtual-message" class="notice" role="status" hidden></div>
    <div id="virtual-empty" class="stage-empty"><div class="setup-icon" aria-hidden="true">↗</div><h3>A fresh perspective, before you launch.</h3><p>First a plan. Then individual reactions. Finally, a clearer picture of what to improve.</p></div>
    <div id="virtual-progress" hidden>
      <div id="virtual-stage" class="run-stage" aria-live="polite"><div class="stage-heading"><div class="stage-orbit">${spark}</div><div><span id="virtual-stage-label" class="stage-pill">Preparing your launch</span><h3 id="virtual-run-status"></h3><p id="virtual-stage-detail"></p></div><span class="stage-elapsed" id="virtual-elapsed"></span></div>
        <ol id="virtual-phases" class="phase-track"><li data-phase="research">Research prices</li><li data-phase="plan">Build the plan</li><li data-phase="audience">Meet the audience</li><li data-phase="optimization">Find improvements</li></ol>
        <div class="run-progress" id="virtual-meter"><div class="progress-caption"><span id="virtual-progress-text"></span><strong id="virtual-percent"></strong></div><div class="progress-track" id="virtual-progress-track"><div class="progress-fill" id="virtual-progress-fill"></div></div><progress id="virtual-progress-bar" class="sr-only" aria-label="Completed individual evaluations" max="20" value="0"></progress></div>
        <ul id="virtual-activity" class="activity-log" aria-label="Recent saved activity"></ul>
      </div>
      <div id="virtual-plan-preview" class="plan-preview" hidden></div>
      <div class="run-actions"><p class="quiet-note" id="virtual-next-hint">Review the plan, then start your pilot.</p><div class="toolbar"><button id="virtual-start" class="primary" type="button">Start my pilot</button><button id="virtual-pause" type="button" hidden>Pause after this batch</button><button id="virtual-view-results" class="primary" data-next-step="3" type="button" hidden>See my insights</button></div></div>
      <div id="virtual-counts" class="result-grid rehearsal-stats" hidden></div><p id="virtual-rates" class="help" hidden></p>
      <div id="virtual-completed-next" class="sticky-next" hidden><span class="help">Now see whether the experience lives up to the promise.</span><button data-next-step="2" type="button">Try the app experience</button></div>
      <details class="editor" id="virtual-plan-editor"><summary>Edit the proposed plan</summary><div class="detail-body"><div id="virtual-plan" style="display:grid;gap:12px"></div><button id="virtual-save-plan" type="button" style="margin-top:20px">Save plan corrections</button><details><summary>Advanced: complete plan JSON</summary><textarea id="virtual-plan-json" class="json" aria-label="AI launch plan JSON"></textarea><button id="virtual-save-json" type="button">Save full AI plan</button></details></div></details>
      <details id="virtual-source-details"><summary>Cost sources & assumptions</summary><div id="virtual-cost-sources"></div><ul id="virtual-limitations"></ul></details>
      <details id="virtual-decisions"><summary>Individual audience reactions</summary><button id="virtual-sample-button" type="button" hidden>Show individual reactions</button><div id="virtual-records"></div><div class="toolbar"><button id="virtual-prev" type="button" disabled>Previous batch</button><button id="virtual-next" type="button" disabled>Next batch</button></div></details>
      <details><summary>Advanced: AI usage & engine details</summary><p id="virtual-usage" class="tech-info"></p></details>
    </div>`;
}

export function rehearsalAppHtml() {
  return `<div id="virtual-app-gate" class="stage-empty"><div class="setup-icon" aria-hidden="true">↗</div><h3>Follow the people who want to try.</h3><p id="virtual-app-gate-message">Run your audience pilot first. Interested virtual visitors can then explore your local test app.</p><button data-next-step="1" type="button">Go to my launch plan</button></div>
    <div id="virtual-app-ready" hidden><p id="virtual-app-summary" class="app-ready-note"></p>
      <form id="virtual-app-form" class="app-form-card"><h3>Give them somewhere to explore.</h3><p style="margin-bottom:22px">Use your locally running test app. Every visitor starts with a fresh browser.</p><div class="form-grid"><label class="field">Local test app address<input id="virtual-test-url" type="url" placeholder="http://127.0.0.1:3000/" required></label><label class="field">Maximum AI browser visitors<input id="virtual-test-users" type="number" min="1" max="5000" value="5" step="1" required><small>Only people who chose to try the product are included.</small></label></div>
        <label class="inline"><input id="virtual-test-consent" type="checkbox" required>This app uses dummy data and has no live payments, outgoing messages or production services.</label><button class="primary" id="virtual-app-start" type="submit">Start exploring my app</button>
      </form>
    </div>
    <div id="app-live-stage" class="run-stage" hidden><div class="stage-heading"><div class="stage-orbit">${spark}</div><div><span class="stage-pill">Inside your app</span><h3 id="app-run-status">Visitors are exploring</h3><p id="app-stage-detail"></p></div></div><div class="run-progress"><div class="progress-caption"><span id="app-progress-text"></span><strong id="app-percent"></strong></div><div id="app-progress-track" class="progress-track"><div id="app-progress-fill" class="progress-fill"></div></div></div><ul id="app-activity" class="activity-log"></ul><div class="run-actions"><p class="quiet-note">Actions are observed in a real browser. Visitor opinions remain AI hypotheses.</p><button id="app-pause" type="button">Pause after this visitor</button></div></div>
    <div id="virtual-app-counts" class="result-grid" hidden></div><div id="virtual-experiences"></div>
    <div class="sticky-next" id="app-insights-next" hidden><span class="help">Turn what you learned into a better next version.</span><button data-next-step="3" type="button">See my insights</button></div>
    <details><summary>Test boundaries & request limits</summary><p class="help">This tests the selected local web app sequentially, using synthetic data. It is not a native mobile or concurrent load test. If the AI request cap is reached, increase it in Launch plan → Budget, preferences & AI limits, then resume your saved run.</p></details>`;
}

export function rehearsalResultsHtml() {
  return `<div id="virtual-results-empty" class="result-placeholder"><div class="setup-icon" style="margin:0 auto 18px" aria-hidden="true">✧</div><h3>Your next best moves will appear here.</h3><p>Finish an audience rehearsal to get focused recommendations. Add app exploration for observations from your product, too.</p><button data-next-step="1" type="button" style="margin-top:12px">Go to my launch plan</button></div><div id="virtual-optimization"></div><details><summary>Compare previous launches</summary><button id="virtual-history-button" type="button">Load saved runs</button><div id="virtual-history"></div></details>`;
}
