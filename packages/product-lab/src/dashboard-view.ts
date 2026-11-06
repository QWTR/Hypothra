import { inlineJson } from "./report.js";
import { dashboardClient } from "./dashboard-client.js";
import { rehearsalClient } from "./rehearsal-client.js";
import { rehearsalSetupHtml, rehearsalAppHtml, rehearsalResultsHtml } from "./rehearsal-view.js";

import { dashboardStyle } from "./dashboard-style.js";
import { dashboardUI } from "./dashboard-ui.js";

export function dashboardHtml(token: string): string {
  return `<!doctype html><html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Hypothra · Your launch workspace</title><style>${dashboardStyle}</style></head>
  <body><div class="app-shell"><aside class="sidebar" aria-label="Workspace navigation">
    <div class="brand"><svg class="brand-icon" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M10 9v22M30 9v22M10 20h20" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><ellipse cx="20" cy="20" rx="17" ry="10" stroke="currentColor" stroke-width="1.3" transform="rotate(-35 20 20)"/></svg>hypothra<span style="font-size:10px;color:#759a83;align-self:start;margin-top:3px">beta</span></div>
    <div class="sidebar-label">Your launch, made clearer</div>
    <div id="sidebar-placeholder" class="sidebar-empty">A little understanding.<br>A better first impression.<br>A more confident launch.</div>
        <nav class="steps" aria-label="Launch setup" hidden>
      <button class="step" data-step="0" aria-current="step"><b>1</b><span>Your product<small>Review the AI summary</small></span></button>
      <button class="step" data-step="1"><b>2</b><span>Launch plan<small>AI creative & audience</small></span></button>
      <button class="step" data-step="2"><b>3</b><span>App checks<small>Interested AI visitors</small></span></button>
      <button class="step" data-step="3"><b>4</b><span>Your results<small>See what needs attention</small></span></button>
    </nav>
    <div class="sidebar-note"><div class="privacy-mark">Your workspace. Your control.</div><p>AI helps you explore possibilities.<br>You choose what happens next.</p></div>
    </aside><div class="workspace"><header class="workspace-bar"><div class="breadcrumb"><span>Workspace</span><span class="dot-separator">/</span><strong id="workspace-project">New project</strong></div><span id="connection-status" class="connection" role="status">Local workspace</span></header><main>
    <header class="workspace-intro" id="workspace-intro"><div class="eyebrow">A clearer way to launch</div><h1>Big ideas.<br>A little less guesswork.</h1><p class="lead">Meet your product through fresh eyes. Understand it, rehearse the launch, and find your next best move.</p><div class="onboarding-flow" aria-hidden="true"><span><i></i>Understand</span><span>→</span><span><i></i>Rehearse</span><span>→</span><span><i></i>Improve</span></div></header>
    <section class="project-picker" aria-label="Project selection">
      <div id="active-project" class="active-project" hidden><div id="project-monogram" class="project-monogram">P</div><div class="project-meta"><strong id="active-project-name">Your project</strong><span class="help" id="folder-current">No project selected yet.</span></div><button id="change-project" type="button">Change folder</button></div>
      <div id="folder-controls" class="project-onboarding"><div class="folder-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" stroke-width="1.5"/><path d="M8 13h8m-4-4v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div><h2>Start with your project.</h2><p>Choose its folder. AI will prepare a product brief for you to review.</p>
        <div class="folder-actions"><button class="primary" id="browse-project" type="button">Browse folders…</button><span class="help">Your files stay where they are.</span></div>
        <details id="folder-manual" class="manual-path"><summary>Or paste a folder path</summary><form id="folder-form"><label class="field">Project folder<input id="project-folder" aria-label="Project folder" required placeholder="D:\\MyProjects\\MyApp" autocomplete="off"></label><button id="open-project" class="primary" type="submit" style="margin-top:12px">Open & analyze project</button></form></details>
      </div>
    </section>
    <div id="status" class="status" role="status" aria-live="polite"></div>

    <section class="panel" data-panel="0" hidden>
      <div class="panel-head"><div><div class="eyebrow">Step 1 of 4</div><h2>Review your product brief.</h2><p>Your code becomes a ready-to-review summary. Change anything the AI misunderstood.</p></div><span class="pill" id="state">Loading…</span></div>
      <div class="run-stage ai-progress" id="ai-progress" role="status" aria-live="polite"><div class="stage-heading"><div class="stage-orbit" aria-hidden="true">✧</div><div><span class="stage-pill">Product understanding</span><h3 id="ai-heading">Preparing your project summary</h3><p id="ai-message">AI will fill in the details automatically.</p></div><span id="ai-elapsed" class="stage-elapsed"></span></div><div id="ai-live-track" class="run-progress"><div class="progress-track" data-indeterminate="true"><div class="progress-fill"></div></div><p class="help">Your source scan is ready. AI is preparing the brief. You can leave this tab open.</p></div><button id="analyze-ai" type="button" style="margin-top:12px">Analyze with AI</button></div>
      <form id="product-form"><article class="product-brief"><div class="brief-top"><div id="brief-avatar" class="brief-avatar">P</div><span class="brief-tag">Your product, understood</span></div><h3 id="brief-name"></h3><p id="brief-description" class="brief-description"></p><dl class="brief-facts"><div><dt>Made for</dt><dd id="brief-audience"></dd></div><div><dt>The value it brings</dt><dd id="brief-value"></dd></div></dl><div id="stack" class="chips"></div></article>
      <details class="editor" id="product-editor"><summary>Edit project details</summary><div class="detail-body"><div class="form-grid">
        <label class="field">Product name<input id="product-name" required maxlength="180" autocomplete="off"></label>
        <label class="field">Who is it for?<input id="product-audience" required maxlength="4000" placeholder="For example: drivers planning weekend trips"><small>Separate different audiences with a semicolon.</small></label>
        <label class="field wide">What does it do?<textarea id="product-description" required maxlength="4000" placeholder="Explain the app in your own words."></textarea></label>
        <label class="field">Why would someone use it?<textarea id="product-value" required maxlength="4000" placeholder="What problem does it solve?"></textarea></label>
        <label class="field">How will it make money?<textarea id="product-money" required maxlength="4000" placeholder="Subscription, one-off payment, ads, or free."></textarea></label>
      </div>
      <details><summary>Correct the technology stack</summary><div id="technology-fields"></div><button type="button" class="muted-button" id="add-technology">+ Add technology</button></details>
      <details><summary>Review the features we found <span id="feature-count"></span></summary><p class="help">A feature found in code still needs a real app check. You can correct its name and description.</p><div id="feature-fields"></div><button type="button" class="muted-button" id="add-feature">+ Add a feature</button></details>
      <details><summary>Edit the user journeys AI understood</summary><div id="product-journeys"></div><button type="button" class="muted-button" id="add-product-journey">+ Add a user journey</button></details>
      <details><summary>Correct the remaining questions</summary><label class="field">Questions or unknowns<textarea id="unknown-notes" placeholder="One question per line. Remove questions you have already answered."></textarea></label></details>
      <details><summary>Questions to check and source references</summary><ul id="unknowns"></ul><p class="help" id="scan"></p><pre id="evidence"></pre></details>
      <button type="submit" id="save-product" style="margin-top:18px">Save changes</button><div id="product-ai-actions"></div></div></details><div class="actions"><div class="right"><span class="step-note" id="approval-note"></span><button type="button" class="primary" id="approve">Looks right — continue</button></div></div>
      </form>
    </section>

    <section class="panel" data-panel="1" hidden>
      <div class="panel-head"><div><div class="eyebrow">Step 2 of 4</div><h2>Put your launch to the test.</h2><p>Let AI propose the plan, then see why individual virtual people would watch, click, try or leave.</p></div></div>
      ${rehearsalSetupHtml()}
      <details id="manual-launch"><summary>Advanced: manual funnel and cost assumptions</summary><form id="launch-form"><div class="form-grid">
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
      <details><summary>Edit your own ad cost assumptions</summary><form id="prices-form"><div id="manual-prices"></div><button type="submit">Save cost assumptions</button></form></details></details>
    </section>

    <section class="panel" data-panel="2" hidden>
      <div class="eyebrow">Step 3 of 4</div><h2>Try the app through fresh eyes.</h2><p>Interested synthetic visitors make their own next-action decisions using your actual local pages. Their opinions and observed browser results stay distinct.</p>
      ${rehearsalAppHtml()}
      <details id="scripted-checks"><summary>Advanced: run predefined browser assertions</summary><div class="notice" id="test-target"></div><div id="journey-list"></div>
      <div class="actions"><button data-step="1">Back</button><div class="right"><button id="run-checks">Run app checks</button><button class="primary" data-step="3">Continue to results</button></div></div>
      <p class="help">Use a test app with dummy data. Checks can submit forms to the local app. They never buy advertisements.</p></details>
    </section>

    <section class="panel" data-panel="3" hidden>
      <div class="panel-head"><div><div class="eyebrow">Step 4 of 4</div><h2>Your next best moves.</h2><p>Review individual reactions, actual test observations and the changes AI recommends.</p></div></div>
      ${rehearsalResultsHtml()}
      <details id="manual-results"><summary>Advanced: deterministic funnel scenarios</summary><select id="result-variant" aria-label="Scenario"><option value="conservative">Cautious</option><option value="central" selected>Expected scenario</option><option value="optimistic">Optimistic</option></select><div id="result-notice" class="notice"></div><div id="result-cards" class="result-grid"></div><div id="findings-summary"></div>
      <div class="actions"><button data-step="2">Back</button><div class="right"><label class="inline"><input id="runtime" type="checkbox"> Include the latest app checks</label><button class="primary" id="run">Calculate launch scenario</button><a href="/report" id="report-link" hidden>Open full report →</a></div></div>
      <p class="help">Expected counts can be fractional. This is a scenario based on your assumptions, not a prediction of real customers.</p></details>
    </section>

    <details class="advanced" hidden><summary>Advanced: inspect or edit JSON</summary><p class="help">Normal setup uses the forms above. These editors expose the complete saved configuration.</p>
      <details><summary>Application model</summary><textarea class="json" id="project" aria-label="Application model JSON" spellcheck="false"></textarea><button id="save-project">Save model JSON</button></details>
      <details><summary>Launch plan</summary><textarea class="json" id="launch" aria-label="Launch plan JSON" spellcheck="false"></textarea><button data-save="launch">Save launch JSON</button></details>
      <details><summary>Ad cost evidence</summary><textarea class="json" id="benchmarks" aria-label="Benchmark JSON" spellcheck="false"></textarea><button data-save="benchmarks">Save evidence JSON</button></details>
      <details><summary>Browser journey definitions</summary><textarea class="json" id="journeys" aria-label="Browser journey JSON" spellcheck="false"></textarea><button data-save="journeys">Save journeys JSON</button></details>
      <p id="revision" class="meta code"></p><button id="reload">Reload saved data / discard edits</button>
    </details>
    <footer class="footer-note">A rehearsal, not a prediction. AI opinions are synthetic; browser findings come from your local test app. Nothing buys or publishes ads.<details><summary>Privacy & model processing</summary>Preparing a launch sends selected project data to your AI engine and checks published ad benchmarks. Local app exploration uses the test environment you select.</details></footer>
    <dialog id="folder-picker" aria-labelledby="folder-picker-title">
      <div class="panel-head"><div><h2 id="folder-picker-title">Choose your project folder</h2><p>Browse a drive, open a folder, then select it below.</p></div><button id="folder-cancel" type="button" aria-label="Close folder picker">Close</button></div>
      <div id="folder-roots" class="toolbar"></div>
      <form id="folder-path-form" class="toolbar" style="margin:14px 0"><button id="folder-parent" type="button">↑ Up</button><input id="folder-path" aria-label="Folder browser path" autocomplete="off" style="flex:1;width:200px" required><button type="submit">Go</button></form>
      <p id="folder-picker-status" role="status" class="help"></p><div id="folder-list" aria-label="Folders"></div>
      <div class="actions"><span class="help">Your application stays in its current location.</span><button id="folder-select" class="primary" type="button">Open & analyze this folder</button></div>
    </dialog>
  <div id="feedback-toast" class="feedback-toast" aria-hidden="true" hidden></div></main></div></div><script>const token=${inlineJson(token)};const ui=(${dashboardUI.toString()})();(${dashboardClient.toString()})(token,ui);(${rehearsalClient.toString()})(token,ui);</script></body></html>`;
}
