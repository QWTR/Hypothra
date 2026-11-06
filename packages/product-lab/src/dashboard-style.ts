export const dashboardStyle = `
:root {
  color-scheme:light;
  --bg:#f5f6f2;
  --panel:#fff;
  --line:#e2e7df;
  --text:#1b302b;
  --muted:#6d7c74;
  --accent:#c4ee86;
  --good:#39845e;
  --bad:#b34439;
  --forest:#153e32;
  --spring:cubic-bezier(.2,.85,.25,1)
}
* {
  box-sizing:border-box
}
body {
  margin:0;
  background:var(--bg);
  color:var(--text);
  font:14px/1.6 "Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased
}
[hidden] {
  display:none!important
}
button,input,textarea,select {
  font:inherit
}
button,a,input,textarea,select,summary {
  -webkit-tap-highlight-color:transparent
}
button,a,summary {
  touch-action:manipulation
}
button {
  position:relative;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:9px;
  min-height:42px;
  border:1px solid #dce3d9;
  background:#fff;
  color:var(--text);
  border-radius:12px;
  padding:10px 17px;
  font-weight:600;
  cursor:pointer;
  transition:transform 180ms var(--spring),background-color 180ms,opacity 180ms,box-shadow 180ms
}
button:hover:not(:disabled) {
  background:#f0f5eb;
  transform:translateY(-1px);
  box-shadow:0 4px 12px #17382b09
}
button:active:not(:disabled) {
  transform:translateY(1px) scale(.975);
  box-shadow:none
}
button.primary {
  background:var(--forest);
  color:#fff;
  border-color:var(--forest);
  box-shadow:0 4px 10px #123f3212
}
button.primary:hover:not(:disabled) {
  background:#20543f
}
button.primary:after {
  content:"";
  width:15px;
  height:15px;
  background:currentColor;
  mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M5 12h14m-6-6 6 6-6 6' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;
  flex-shrink:0;
  transition:transform 200ms var(--spring)
}
button.primary:hover:after {
  transform:translateX(3px)
}
button:disabled {
  opacity:.45;
  cursor:not-allowed;
  transform:none;
  box-shadow:none
}
button[aria-busy=true] {
  opacity:1;
  cursor:progress
}
button[aria-busy=true]:before {
  content:"";
  width:15px;
  height:15px;
  border:2px solid currentColor;
  border-right-color:transparent;
  border-radius:50%;
  animation:spin .8s linear infinite;
  flex-shrink:0
}
button[aria-busy=true]:after {
  display:none
}
a {
  color:#2d7352;
  text-underline-offset:3px
}
button:focus-visible,a:focus-visible,summary:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible {
  outline:3px solid #9dcf72;
  outline-offset:4px
}
input,select,textarea {
  width:100%;
  min-width:0;
  border:1px solid #dce3d9;
  background:#fbfcf9;
  color:var(--text);
  border-radius:11px;
  padding:12px 14px;
  transition:border-color 180ms,box-shadow 180ms
}
input:hover,textarea:hover,select:hover {
  border-color:#b1c3b2
}
input:focus,textarea:focus,select:focus {
  border-color:#7ba569;
  box-shadow:0 0 0 3px #9fcf7218
}
input[type=checkbox] {
  width:17px;
  height:17px;
  accent-color:var(--forest);
  flex-shrink:0
}
textarea {
  font:inherit;
  line-height:1.65;
  min-height:110px;
  resize:vertical
}
input:disabled,textarea:disabled {
  opacity:.65
}
p {
  margin:8px 0;
  color:var(--muted)
}
h1,h2,h3 {
  line-height:1.2;
  letter-spacing:-.04em
}
h1 {
  font-size:clamp(36px,4vw,52px);
  font-weight:650;
  margin:12px 0 18px
}
h2 {
  font-size:clamp(25px,3vw,34px);
  font-weight:650;
  margin:8px 0 12px
}
h3 {
  font-size:19px;
  font-weight:650;
  margin:0 0 10px
}
.eyebrow {
  font-size:10px;
  letter-spacing:.17em;
  font-weight:700;
  text-transform:uppercase;
  color:#7f9478
}
.lead {
  font-size:16px;
  max-width:530px
}
.help,small,.meta {
  font-size:12px;
  color:var(--muted);
  font-weight:400;
  line-height:1.6
}
.sr-only {
  position:absolute;
  width:1px;
  height:1px;
  overflow:hidden;
  clip:rect(0,0,0,0)
}
.app-shell {
  display:grid;
  grid-template-columns:238px minmax(0,1fr);
  min-height:100vh
}
.sidebar {
  position:sticky;
  top:0;
  height:100vh;
  background:#142f29;
  color:#f2f7ee;
  padding:34px 22px;
  display:flex;
  flex-direction:column;
  overflow:auto
}
.brand {
  display:flex;
  align-items:center;
  gap:12px;
  font-size:25px;
  font-weight:650;
  letter-spacing:-.07em;
  color:#fff
}
.brand-icon {
  width:31px;
  height:31px;
  color:#ceefa2;
  flex-shrink:0
}
.sidebar-label {
  margin-top:62px;
  margin-bottom:16px;
  font-size:10px;
  letter-spacing:.18em;
  text-transform:uppercase;
  color:#8fa49a
}
.steps {
  display:grid;
  gap:12px
}
.step {
  background:transparent;
  border:0;
  box-shadow:none!important;
  color:#b3c2b8;
  justify-content:flex-start;
  text-align:left;
  padding:13px 12px;
  gap:12px;
  border-radius:12px;
  min-height:67px
}
.step:hover:not(:disabled) {
  background:#ffffff09;
  color:#fff
}
.step b {
  display:grid;
  place-items:center;
  width:29px;
  height:29px;
  flex-shrink:0;
  border:1px solid #587066;
  border-radius:50%;
  font-size:11px;
  font-weight:500;
  transition:background 200ms,color 200ms
}
.step span {
  font-size:13px;
  font-weight:600;
  line-height:1.4
}
.step small {
  display:block;
  color:#8fa69a;
  font-size:10px;
  font-weight:400;
  margin-top:4px
}
.step[aria-current=step] {
  background:#d7f7ab;
  color:#193d2e
}
.step[aria-current=step] b {
  background:#244b34;
  color:#e6f5d5;
  border-color:#244b34
}
.step[aria-current=step] small {
  color:#5c7756
}
.step[data-done=true] b {
  background:#2e5141;
  color:#c8e9a7;
  border-color:#4b6c4e
}
.sidebar-note {
  margin-top:auto;
  padding-top:50px;
  color:#a2b6a8;
  font-size:12px;
  line-height:1.7
}
.privacy-mark {
  display:flex;
  align-items:center;
  gap:8px;
  color:#d2e8c4;
  font-size:11px
}
.privacy-mark:before {
  content:"";
  width:6px;
  height:6px;
  border-radius:50%;
  background:#c1ee8c
}
.sidebar-note p {
  color:#829b8c;
  font-size:11px
}
.sidebar-empty {
  font-size:13px;
  line-height:1.9;
  color:#9bb0a2;
  padding:12px
}
.workspace {
  min-width:0
}
.workspace-bar {
  height:83px;
  border-bottom:1px solid var(--line);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:15px;
  padding:0 46px;
  color:var(--muted);
  font-size:12px
}
.workspace-bar strong {
  color:var(--text);
  font-weight:600
}
.breadcrumb {
  display:flex;
  gap:10px;
  align-items:center;
  min-width:0
}
.breadcrumb strong {
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap
}
.connection {
  display:inline-flex;
  align-items:center;
  gap:7px;
  font-size:11px;
  white-space:nowrap
}
.connection:before {
  content:"";
  width:6px;
  height:6px;
  border-radius:50%;
  background:#80a979
}
.connection[data-offline=true] {
  color:var(--bad)
}
.connection[data-offline=true]:before {
  background:var(--bad)
}
main {
  max-width:1060px;
  margin:0 auto;
  padding:33px 46px 45px;
  min-width:0
}
.workspace-intro {
  padding:30px 0 20px;
  max-width:650px
}
.project-picker {
  margin:0 0 25px
}
.project-onboarding {
  background:white;
  border:1px solid var(--line);
  border-radius:20px;
  padding:32px;
  max-width:660px;
  box-shadow:0 8px 28px #1e3b2404
}
.folder-symbol {
  display:grid;
  place-items:center;
  width:54px;
  height:54px;
  background:#eef4e6;
  border-radius:16px;
  color:#48613f;
  margin-bottom:22px
}
.folder-symbol svg {
  width:27px;
  height:27px
}
.project-onboarding h2 {
  font-size:23px;
  margin:0 0 9px
}
.folder-actions {
  display:flex;
  gap:10px;
  align-items:center;
  margin-top:22px
}
.manual-path {
  margin-top:20px
}
.manual-path>summary {
  font-size:12px
}
.active-project {
  display:flex;
  align-items:center;
  gap:13px;
  background:#ecf0e7;
  border:1px solid #dfe5d7;
  border-radius:14px;
  padding:13px 17px
}
.project-monogram {
  display:grid;
  place-items:center;
  width:36px;
  height:36px;
  background:#dde7d2;
  border-radius:11px;
  font-size:13px;
  font-weight:700;
  flex-shrink:0
}
.active-project .project-meta {
  min-width:0;
  flex:1
}
.active-project strong {
  display:block;
  font-size:13px
}
.active-project .help {
  display:block;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  font-size:10px
}
.active-project button {
  background:transparent;
  border:0;
  font-size:11px;
  min-height:34px;
  padding:6px 9px
}
.panel {
  background:transparent;
  padding:0;
  margin:0;
  border:0;
  min-width:0;
  animation:arrive 300ms var(--spring)
}
.panel-head {
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:18px;
  margin-bottom:25px
}
.panel-head p {
  max-width:620px
}
.pill {
  display:inline-flex;
  align-items:center;
  white-space:nowrap;
  padding:6px 11px;
  border:1px solid #d9e2d2;
  background:#f0f5e9;
  color:#628050;
  font-size:10px;
  border-radius:99px;
  letter-spacing:.02em
}
.product-brief {
  background:white;
  border:1px solid var(--line);
  border-radius:20px;
  padding:28px 30px;
  box-shadow:0 6px 30px #243e2204;
  margin-bottom:14px
}
.brief-top {
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:15px;
  margin-bottom:22px
}
.brief-avatar {
  display:grid;
  place-items:center;
  width:48px;
  height:48px;
  border-radius:14px;
  background:#eaf2df;
  color:#557345;
  font-size:19px;
  font-weight:650
}
.brief-tag {
  font-size:10px;
  color:#7e9573;
  letter-spacing:.12em;
  text-transform:uppercase
}
.product-brief h3 {
  font-size:28px;
  margin-bottom:10px
}
.product-brief>.brief-description {
  font-size:15px;
  color:#66776d;
  line-height:1.85;
  max-width:720px;
  display:-webkit-box;
  -webkit-line-clamp:4;
  -webkit-box-orient:vertical;
  overflow:hidden
}
.brief-facts {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:25px;
  padding-top:23px;
  margin-top:24px;
  border-top:1px solid var(--line)
}
.brief-facts dt {
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:.09em;
  color:#8b9a82;
  margin-bottom:8px
}
.brief-facts dd {
  margin:0;
  color:#566a5c;
  font-size:12px;
  line-height:1.8
}
.chips {
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  margin:18px 0 0
}
.chip {
  font-size:10px;
  color:#607451;
  background:#f0f4e9;
  border:1px solid #e7eddd;
  border-radius:6px;
  padding:4px 8px
}
.product-brief>.chips .chip:nth-child(n+9) {
  display:none
}
.actions {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:16px;
  margin-top:25px;
  padding-top:20px;
  border-top:1px solid var(--line);
  flex-wrap:wrap
}
.actions .right,.toolbar,.inline {
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap:wrap
}
.step-note {
  color:#889781;
  font-size:11px;
  max-width:290px
}
.right {
  margin-left:auto
}
.form-grid {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:19px
}
.wide {
  grid-column:1/-1
}
label.field {
  display:flex;
  flex-direction:column;
  gap:7px;
  font-size:12px;
  font-weight:600
}
details {
  border-top:1px solid var(--line);
  padding:16px 0;
  margin-top:15px
}
summary {
  cursor:pointer;
  list-style:none;
  color:#6c7f63;
  font-size:12px;
  font-weight:550;
  display:flex;
  align-items:center;
  gap:10px
}
summary::-webkit-details-marker {
  display:none
}
summary:before {
  content:"+";
  display:grid;
  place-items:center;
  width:21px;
  height:21px;
  background:#eaf0e2;
  color:#748a65;
  border-radius:6px;
  font-size:15px;
  flex-shrink:0
}
details[open]>summary {
  margin-bottom:22px
}
details[open]>summary:before {
  content:"−"
}
details[open]>.detail-body {
  animation:arrive 220ms var(--spring)
}
.editor {
  background:#fafbf7;
  border:1px solid var(--line);
  border-radius:14px;
  padding:16px 20px;
  margin:12px 0
}
.editor>summary {
  font-size:12px
}
.editor .form-grid {
  margin-bottom:22px
}
.advanced {
  margin-top:32px
}
.json {
  font:11px/1.7 ui-monospace,monospace;
  min-height:300px
}
.notice,.status {
  border-radius:11px;
  font-size:12px;
  line-height:1.75;
  padding:13px 16px;
  margin:14px 0;
  border:1px solid #dfe7d5;
  background:#f1f5e9;
  color:#61774f;
  overflow-wrap:anywhere
}
.notice p {
  color:inherit;
  font-size:12px
}
.notice.good {
  background:#edf6e4;
  border-color:#d8e8c8;
  color:#466b38
}
.notice.warn,.status.error {
  background:#fff2e8;
  border-color:#efdcc9;
  color:#a66b37
}
.status.success {
  color:#437449;
  border-color:#dcebd0;
  background:#f1f7ea
}
.status:empty {
  display:none
}
.status {
  animation:arrive 200ms var(--spring)
}
.status[role=status] {
  margin-top:0
}
.subcard,.card,.source-card {
  background:#fff;
  border:1px solid var(--line);
  border-radius:16px;
  padding:22px;
  margin:14px 0
}
.subcard p {
  font-size:12px
}
.result-grid,.budget-strip {
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:11px;
  margin:20px 0
}
.card {
  padding:20px;
  margin:0;
  min-width:0;
  overflow-wrap:anywhere
}
.number {
  display:block;
  font-size:32px;
  line-height:1.25;
  letter-spacing:-.055em;
  font-weight:650;
  font-variant-numeric:tabular-nums;
  margin-top:9px
}
.label {
  color:#829176;
  font-size:10px
}
.budget-strip {
  grid-template-columns:repeat(3,minmax(0,1fr))
}
.budget-strip>div {
  padding:15px;
  background:#eef2e8;
  border-radius:10px;
  min-width:0
}
.budget-strip strong {
  display:block;
  font-size:20px;
  overflow-wrap:anywhere
}
.price-grid {
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:10px
}
.price {
  font-size:23px;
  font-weight:650
}
.price small {
  font-size:10px
}
.source-card a {
  font-size:11px;
  overflow-wrap:anywhere
}
.source-card p {
  font-size:11px
}
.source-card label {
  display:flex;
  gap:10px;
  align-items:flex-start
}
.source-card.selected {
  border-color:#8ca676
}
.tech-row {
  display:grid;
  grid-template-columns:1fr 1fr auto;
  gap:9px;
  margin:8px 0
}
.feature-row {
  border-bottom:1px solid var(--line);
  padding:15px 0
}
.feature-row textarea {
  min-height:75px;
  margin:8px 0
}
.feature-row input {
  font-weight:600
}
.muted-button {
  background:transparent
}
.rate-grid {
  display:grid;
  grid-template-columns:2fr repeat(3,1fr);
  gap:8px;
  font-size:11px;
  margin:8px 0
}
.rate-grid input {
  padding:8px
}
.journey {
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:20px;
  border-bottom:1px solid var(--line);
  padding:18px 0
}
.outcome {
  border-radius:20px;
  background:#edf3e6;
  color:#667e53;
  font-size:10px;
  padding:4px 10px
}
.summary-line {
  display:flex;
  gap:10px;
  align-items:center;
  flex-wrap:wrap
}
pre {
  font:11px/1.7 ui-monospace,monospace;
  white-space:pre-wrap;
  overflow-wrap:anywhere
}
.code {
  overflow-wrap:anywhere
}
.scroll {
  overflow:auto
}
ul {
  padding-left:20px
}
.launch-setup {
  background:#fff;
  border:1px solid var(--line);
  border-radius:20px;
  padding:28px
}
.launch-setup .field>textarea {
  min-height:100px;
  background:#fafcf7
}
.launch-setup h3 {
  font-size:21px
}
.setup-topline {
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:20px
}
.setup-icon {
  width:38px;
  height:38px;
  background:#edf4e4;
  color:#6f8b52;
  border-radius:11px;
  display:grid;
  place-items:center;
  font-size:18px
}
.setup-footer {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:20px;
  margin-top:22px
}
.setup-footer .help {
  max-width:330px
}
.optional-badge {
  color:#9eac94;
  font-weight:400
}
.launch-setup details {
  margin:15px 0 0;
  padding-bottom:0
}
.audience-picker {
  display:flex;
  gap:15px;
  align-items:center
}
.audience-picker label {
  flex:1
}
.plan-preview {
  background:#fff;
  border:1px solid var(--line);
  border-radius:20px;
  padding:26px 28px;
  margin:20px 0
}
.plan-preview h3 {
  font-size:24px;
  max-width:600px
}
.plan-preview p {
  font-size:13px;
  line-height:1.9
}
.plan-preview .plan-stats {
  display:flex;
  gap:28px;
  flex-wrap:wrap;
  margin-top:20px;
  padding-top:18px;
  border-top:1px solid var(--line)
}
.plan-stats small {
  display:block;
  font-size:10px
}
.plan-stats strong {
  font-size:18px;
  font-weight:600
}
.creative-preview {
  background:#f3f6ed;
  border-radius:12px;
  padding:17px 19px;
  margin-top:19px;
  color:#5c7551
}
.creative-preview small {
  display:block;
  font-size:9px;
  letter-spacing:.12em;
  text-transform:uppercase;
  color:#92a47e;
  margin-bottom:6px
}
.creative-preview strong {
  font-weight:550;
  font-size:15px
}
.run-stage {
  background:#fff;
  border:1px solid var(--line);
  border-radius:20px;
  margin:20px 0;
  padding:28px;
  position:relative;
  overflow:hidden
}
.stage-heading {
  display:flex;
  align-items:center;
  gap:18px
}
.stage-orbit {
  position:relative;
  display:grid;
  place-items:center;
  width:58px;
  height:58px;
  border:1px solid #dbe6cd;
  border-radius:50%;
  flex-shrink:0;
  background:#f7faf2;
  color:#608344
}
.stage-orbit:before {
  content:"";
  position:absolute;
  inset:-4px;
  border:1px solid transparent;
  border-top-color:#91b964;
  border-right-color:#bad59c;
  border-radius:50%;
  animation:spin 2.6s linear infinite
}
.stage-orbit svg {
  width:24px;
  height:24px
}
.run-stage:not([data-working=true]) .stage-orbit:before {
  animation:none;
  border-color:#dce8d0
}
.run-stage h3 {
  font-size:20px;
  margin:0 0 5px
}
.stage-heading p {
  font-size:12px;
  margin:0;
  line-height:1.7
}
.stage-pill {
  display:inline-flex;
  align-items:center;
  gap:6px;
  color:#7b945f;
  font-size:10px;
  text-transform:uppercase;
  letter-spacing:.08em;
  margin-bottom:9px
}
.stage-pill:before {
  content:"";
  width:5px;
  height:5px;
  background:#97ba6b;
  border-radius:50%
}
.run-stage[data-working=true] .stage-pill:before {
  animation:breathe 1.8s ease-in-out infinite
}
.phase-track {
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:12px;
  margin:25px 0 10px;
  padding:0;
  list-style:none
}
.phase-track li {
  font-size:10px;
  color:#a3ad9c;
  position:relative;
  padding-top:15px;
  border-top:2px solid #edf0e7
}
.phase-track li[data-state=done] {
  color:#55783f;
  border-color:#a5c47f
}
.phase-track li[data-state=active] {
  color:#3f6330;
  border-color:#a5c47f
}
.phase-track li[data-state=active]:before {
  content:"";
  position:absolute;
  width:6px;
  height:6px;
  border-radius:50%;
  background:#729f46;
  top:-4px;
  left:0;
  animation:breathe 1.5s infinite
}
.run-progress {
  margin-top:24px;
  display:grid;
  gap:12px
}
.progress-caption {
  display:flex;
  align-items:center;
  justify-content:space-between;
  font-size:11px;
  color:#849576;
  gap:15px
}
.progress-caption strong {
  font-variant-numeric:tabular-nums;
  font-size:13px;
  color:#527541
}
.progress-track {
  height:6px;
  background:#edf1e5;
  border-radius:9px;
  overflow:hidden
}
.progress-fill {
  height:100%;
  background:#a4c879;
  transform:scaleX(0);
  transform-origin:left;
  transition:transform 450ms var(--spring);
  border-radius:9px
}
.progress-track[data-indeterminate=true] .progress-fill {
  width:35%;
  transform:translateX(-110%);
  animation:travel 1.8s ease-in-out infinite
}
.activity-log {
  margin:18px 0 0;
  padding:0;
  list-style:none;
  display:grid;
  gap:7px;
  font-size:11px;
  color:#8a9a7e
}
.activity-log li {
  display:flex;
  gap:9px;
  align-items:baseline
}
.activity-log time {
  font-variant-numeric:tabular-nums;
  font-size:9px;
  color:#a6b39c
}
.activity-log li:last-child {
  color:#5b7748
}
.activity-log li:before {
  content:"";
  width:4px;
  height:4px;
  border-radius:50%;
  background:#a9be94;
  align-self:center;
  flex-shrink:0
}
.stage-elapsed {
  margin-left:auto;
  color:#93a184;
  font-size:11px;
  font-variant-numeric:tabular-nums;
  white-space:nowrap
}
.run-actions {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:15px;
  margin-top:23px
}
.quiet-note {
  font-size:11px;
  color:#8a9980;
  max-width:430px
}
.stage-empty {
  text-align:center;
  padding:38px 25px;
  background:#f0f3ea;
  border:1px dashed #dbe3d1;
  border-radius:18px
}
.stage-empty h3 {
  font-size:20px
}
.stage-empty p {
  font-size:12px;
  max-width:430px;
  margin:10px auto
}
.stage-empty .setup-icon {
  margin:0 auto 18px
}
.rehearsal-stats {
  margin:22px 0
}
.sticky-next {
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin:25px 0 0;
  gap:12px
}
.result-placeholder {
  padding:40px;
  text-align:center;
  border:1px dashed #dce5d2;
  border-radius:20px;
  background:#f0f4e9
}
.result-placeholder p {
  max-width:410px;
  margin:10px auto
}
.recommendation {
  border-left:3px solid #b2ce91
}
.recommendation strong {
  font-size:15px;
  font-weight:600
}
.recommendation .recommendation-meta {
  display:flex;
  gap:8px;
  font-size:10px;
  margin-bottom:10px;
  color:#8a9e77
}
.recommendation details {
  margin-top:12px;
  padding:10px 0 0
}
.inline-disclosure {
  margin:8px 0 0
}
.app-form-card {
  background:#fff;
  border:1px solid var(--line);
  padding:25px;
  border-radius:18px
}
.app-form-card .inline {
  font-size:11px;
  line-height:1.8;
  margin:18px 0
}
.app-ready-note {
  font-size:12px;
  color:#61794f;
  margin-bottom:20px
}
.tech-info {
  font-size:10px!important;
  line-height:1.8!important
}
.page-caption {
  font-size:11px;
  color:#91a085
}
.dot-separator {
  color:#c7d1c0
}
.mobile-brand {
  display:none
}
.footer-note {
  font-size:10px;
  color:#9ca993;
  border-top:1px solid var(--line);
  padding-top:20px;
  margin-top:35px;
  line-height:1.8
}
.busy-note {
  color:#6b8d4f
}
dialog {
  color:var(--text);
  background:#fff;
  border:1px solid #dfe7d4;
  border-radius:22px;
  padding:28px;
  width:min(720px,calc(100vw - 32px));
  max-height:88vh;
  box-shadow:0 30px 100px #172d2330
}
dialog::backdrop {
  background:#16362960;
  backdrop-filter:blur(5px)
}
dialog[open] {
  animation:arrive 220ms var(--spring)
}
dialog .panel-head h2 {
  font-size:24px
}
#folder-list {
  max-height:38vh;
  min-height:130px;
  overflow:auto;
  border:1px solid var(--line);
  border-radius:12px
}
#folder-list button {
  display:flex;
  justify-content:flex-start;
  text-align:left;
  width:100%;
  border:0;
  border-radius:0;
  border-bottom:1px solid #edf1e8;
  background:#fff;
  overflow-wrap:anywhere;
  box-shadow:none;
  padding:13px 16px
}
#folder-list button:hover {
  background:#f2f7e9;
  transform:none
}
#folder-path {
  flex:1;
  width:200px;
  min-width:100px
}
#folder-roots button {
  background:#f1f6e9
}
#folder-current {
  overflow-wrap:anywhere
}
footer {
  margin-top:30px
}
.onboarding-flow {
  display:flex;
  align-items:center;
  gap:12px;
  margin:25px 0 5px;
  font-size:11px;
  color:#8d9e80
}
.onboarding-flow span {
  display:flex;
  align-items:center;
  gap:8px
}
.onboarding-flow i {
  width:6px;
  height:6px;
  background:#b2cc93;
  border-radius:50%
}
.connection-warning {
  color:var(--bad);
  font-size:11px
}
.ai-progress[data-complete=true] {
  padding:11px 16px;
  background:#eef5e7;
  border-color:#dce8d0;
  border-radius:11px;
  margin:0 0 18px
}
.ai-progress[data-complete=true] .stage-orbit,.ai-progress[data-complete=true] .stage-pill,.ai-progress[data-complete=true] #ai-message {
  display:none
}
.ai-progress[data-complete=true] h3 {
  font-size:11px;
  letter-spacing:0;
  margin:0;
  color:#658153;
  font-weight:500
}
.preview-description {
  display:-webkit-box;
  -webkit-line-clamp:3;
  -webkit-box-orient:vertical;
  overflow:hidden
}
.campaign-settings {
  border:0;
  padding:0;
  margin:0
}
.campaign-settings>summary {
  margin-bottom:16px
}
.feedback-toast {
  position:fixed;
  z-index:60;
  right:25px;
  bottom:25px;
  max-width:min(420px,calc(100vw - 32px));
  padding:15px 20px;
  border:1px solid #dce7d2;
  background:#fff;
  color:#5e7a48;
  box-shadow:0 12px 45px #203b2220;
  border-radius:14px;
  font-size:12px;
  animation:arrive 200ms var(--spring)
}
.feedback-toast[data-error=true] {
  color:#a66338;
  border-color:#e9d7c8
}
body[data-offline=true] .stage-orbit:before,body[data-offline=true] .progress-fill {
  animation-play-state:paused!important
}
h2[tabindex="-1"]:focus {
  outline:none
}
.status.initial-ready {
  border:0;
  background:none;
  padding:0;
  font-size:11px;
  margin:0 0 17px;
  color:#8b9b81
}
.step[aria-current=step]:hover:not(:disabled) {
  background:#d7f7ab;
  color:#193d2e;
  transform:none
}
.brief-facts dd {
  display:-webkit-box;
  -webkit-line-clamp:3;
  -webkit-box-orient:vertical;
  overflow:hidden
}
.run-stage[data-compact=true] {
  padding:17px 22px
}
.run-stage[data-compact=true] .phase-track,.run-stage[data-compact=true] .activity-log,.run-stage[data-compact=true] .run-progress {
  display:none
}
.run-stage[data-compact=true] h3 {
  font-size:17px
}
.run-stage[data-compact=true] .stage-orbit {
  width:40px;
  height:40px
}
.run-stage[data-compact=true] .stage-pill {
  font-size:8px;
  margin-bottom:4px
}
#product-form>.actions,.run-actions {
  position:sticky;
  bottom:15px;
  z-index:10;
  background:#f5f6f2ed;
  backdrop-filter:blur(12px);
  border:1px solid #e2e8d9;
  border-radius:14px;
  padding:13px 17px;
  box-shadow:0 5px 25px #193e2607
}
.feedback-toast {
  bottom:90px
}
@keyframes spin {
  to {
    transform:rotate(360deg)
  }
}
@keyframes arrive {
  from {
    opacity:0;
    transform:translateY(10px)
  }
  to {
    opacity:1;
    transform:translateY(0)
  }
}
@keyframes breathe {
  0%,100% {
    opacity:.4
  }
  50% {
    opacity:1
  }
}
@keyframes travel {
  0% {
    transform:translateX(-110%)
  }
  100% {
    transform:translateX(390%)
  }
}
@media(min-width:1500px) {
  main {
    padding-top:45px
  }
  .workspace-bar {
    padding:0 65px
  }
  .sidebar {
    padding:38px 25px
  }
  .app-shell {
    grid-template-columns:260px minmax(0,1fr)
  }
}
@media(max-width:1050px) {
  .app-shell {
    grid-template-columns:200px minmax(0,1fr)
  }
  .sidebar {
    padding:28px 16px
  }
  .workspace-bar {
    padding:0 28px
  }
  main {
    padding:28px
  }
  .step {
    padding:11px 8px;
    gap:9px
  }
  .step small {
    font-size:9px
  }
  .result-grid {
    grid-template-columns:repeat(2,minmax(0,1fr))
  }
  .number {
    font-size:29px
  }
}
@media(max-width:760px) {
  .app-shell {
    display:block
  }
  .sidebar {
    position:sticky;
    z-index:20;
    top:0;
    height:auto;
    padding:13px 16px 9px;
    overflow:visible;
    background:#142f29
  }
  .brand {
    font-size:20px;
    gap:8px
  }
  .brand-icon {
    width:25px;
    height:25px
  }
  .sidebar-label,.sidebar-note,.sidebar-empty {
    display:none
  }
  .steps {
    display:grid;
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:5px;
    margin-top:12px
  }
  .step {
    display:flex;
    justify-content:center;
    gap:7px;
    min-height:43px;
    padding:8px 3px;
    border-radius:8px
  }
  .step b {
    width:20px;
    height:20px;
    font-size:9px
  }
  .step span {
    font-size:10px
  }
  .step small {
    display:none
  }
  .workspace-bar {
    height:51px;
    padding:0 20px;
    font-size:10px
  }
  .connection {
    font-size:9px
  }
  main {
    padding:23px 20px 35px
  }
  .workspace-intro {
    padding:15px 0 20px
  }
  h1 {
    font-size:38px
  }
  h2 {
    font-size:27px
  }
  .panel-head {
    margin-bottom:20px
  }
  .panel-head .pill {
    font-size:9px;
    padding:5px 8px;
    margin-top:4px
  }
  .project-brief,.product-brief {
    padding:23px
  }
  .brief-facts {
    gap:18px
  }
  .product-onboarding,.project-onboarding {
    padding:25px
  }
  .active-project {
    padding:11px 13px
  }
  .launch-setup,.run-stage,.plan-preview {
    padding:23px
  }
  .setup-footer {
    align-items:flex-start;
    flex-direction:column;
    gap:10px
  }
  .setup-footer button {
    width:100%
  }
  .setup-footer .help {
    max-width:none
  }
  .stage-heading {
    gap:13px
  }
  .stage-orbit {
    width:45px;
    height:45px
  }
  .stage-elapsed {
    font-size:10px
  }
  .run-stage h3 {
    font-size:18px
  }
  .phase-track {
    gap:7px
  }
  .phase-track li {
    font-size:9px
  }
  .form-grid {
    grid-template-columns:1fr
  }
  .wide {
    grid-column:auto
  }
  .tech-row {
    grid-template-columns:1fr
  }
  .rate-grid {
    grid-template-columns:1.5fr repeat(3,minmax(0,1fr));
    gap:4px
  }
  .rate-grid input {
    padding:6px 3px
  }
  .run-actions {
    align-items:flex-start;
    flex-direction:column
  }
  .run-actions .toolbar {
    width:100%
  }
  .run-actions .toolbar button.primary {
    flex:1
  }
  .brief-facts dd {
    font-size:11px
  }
  .actions>.right {
    width:100%
  }
  .actions .primary {
    width:100%
  }
  .editor {
    padding:14px 16px
  }
  .plan-stats {
    gap:18px!important
  }
  .plan-stats strong {
    font-size:17px
  }
  .source-card,.subcard {
    padding:18px
  }
  .app-form-card {
    padding:20px
  }
  .audience-picker {
    align-items:flex-start;
    flex-direction:column
  }
  .audience-picker label {
    width:100%
  }
  .result-placeholder {
    padding:28px 20px
  }
  dialog {
    padding:20px
  }
  .onboarding-flow {
    gap:8px;
    font-size:10px
  }
  #folder-path-form {
    flex-wrap:wrap
  }
  #folder-path {
    width:120px
  }
  .quiet-note {
    font-size:10px
  }
  .toolbar button {
    font-size:12px
  }
  .product-brief h3 {
    font-size:25px
  }
  .stage-heading>div {
    min-width:0
  }
  .stage-heading .stage-elapsed {
    display:none
  }
  .breadcrumb {
    min-width:0
  }
  .step:after {
    display:none
  }
}
@media(max-width:390px) {
  main {
    padding-left:15px;
    padding-right:15px
  }
  .step b {
    display:none
  }
  .step span {
    font-size:10px
  }
  .product-brief,.launch-setup,.run-stage,.plan-preview {
    padding:19px
  }
  .brief-facts {
    grid-template-columns:1fr;
    gap:14px
  }
  .phase-track li {
    font-size:8px
  }
  .workspace-bar {
    padding:0 15px
  }
  .connection {
    font-size:8px
  }
  .card {
    padding:17px
  }
  .number {
    font-size:27px
  }
}
@media(prefers-reduced-motion:reduce) {
  *,*:before,*:after {
    animation:none!important;
    transition:none!important;
    scroll-behavior:auto!important
  }
  .progress-track[data-indeterminate=true] .progress-fill {
    transform:scaleX(1);
    opacity:.5
  }
  button:hover:not(:disabled),button:active:not(:disabled) {
    transform:none
  }
}
`;
