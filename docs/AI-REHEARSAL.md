# AI virtual launch and product exploration

Hypothra's primary workflow is an AI rehearsal of a launch. It does not require
the owner to invent CTR, install rates or activation percentages.

## Use the panel

1. Select your project folder. Let AI fill the understanding, correct it, then
   confirm the exact product version.
2. Open **Launch plan**. Optionally describe a reel, advertisement or launch idea
   and constraints such as a maximum budget. Leave them empty for an AI proposal.
3. Start with the **20-person pilot** and choose **Build my launch plan**.
   AI proposes audience segments, their motivations, a script/hook/CTA, other costs
   and a budget. Public Meta/TikTok CPM references are researched automatically;
   advertising accounts and their API keys are not required.
4. Review the plan. Edit the script, cost amounts or proposed budget directly;
   the complete plan editor also exposes segment shares and every other field.
   Corrections must be saved before starting. Plans become immutable after the
   first evaluated viewer; prepare a new variant to change them.
5. Start the AI audience. Each requested ID receives its own profile, watch/click/
   try decisions and reason. Inspect batches to see every counted decision.
6. If you have a local app with synthetic data, open **App checks**, enter its
   explicit loopback address and choose how many interested installers may visit.
   Confirm the app has no production services, then start AI exploration.
7. Open **Your results** for evidence-linked marketing and product recommendations.
   Compare saved runs after changing the creative or product.

The panel shows a compact brief and a single next action. **Edit project details**
and **Edit the proposed plan** expand the full editors. Costs, source evidence,
individual reactions and engine usage are secondary disclosures rather than
required setup screens. The sidebar remains usable during requests. Buttons show
their own pending state; real saved activity reports price research, model work,
batch saves and performed browser actions. Unknown-duration model work stays
indeterminate. Percentages come only from completed people or visits. Motion
respects the operating system's reduced-motion preference.

## What actually runs

The audience engine assigns stable per-run IDs and an AI-proposed segment to each
person. A bounded model call generates at most 10 individual decisions in the
panel (the engine supports batch sizes 1–20). No target CTR is supplied. A missing,
duplicate, invented or impossible watch/click/install decision fails validation.
An install decision means hypothetical intent to try the app; no device download
has been observed.

Audience counts are sums of saved records, never a pilot multiplied by a requested
population. Requesting 100,000 people while completing 20 produces a report of
**20 completed out of 100,000**, not 100,000 evaluated people. Shared model calls
can produce correlated opinions; these are not 100,000 independently validated
human responses or separate trained AI models.

Each browser visitor must be an individually evaluated installer. The engine opens
a fresh Chromium context, observes actual visible text and controls, asks AI for
one next action, validates its selector, performs it, and observes the resulting
page again. It permits at most eight decisions per visitor. Synthetic input values
are supplied by the host, including unique `example.invalid` email addresses.
There are no arbitrary model-supplied scripts, shell commands or navigation URLs.
Runtime errors and failed actions are recorded separately from the AI's opinion.
A safety-boundary block is not reported as a reproduced application defect.

An AI may say a community feels empty only as an opinion about observed page
content; it has not interviewed customers. A specific HTTP 500 or failed click
is an observation of that local visit. Neither proves real retention, conversion
or infrastructure capacity. Browser visitors run sequentially; this is not a
5,000-person concurrent load test. Native mobile apps and real app-store installs
are not emulated; the current runner handles local web interfaces.

## Scale, progress and recovery

The audience limit is 100,000. The local browser limit is 5,000, additionally capped
at the number of completed synthetic install intentions. Those are job limits,
not a claim that a full-size run has already completed or a performance benchmark.

Large runs can take a long time and consume substantial AI account usage. Start
with the pilot, inspect the judgments, and raise the target only when the approach
is useful. Each browser visitor needs up to eight additional model requests.
The request cap is enforced before every request, including planning and final
recommendations. Reaching it pauses the run. Raise the cap and resume to continue.

Pause completes the current audience batch or browser visitor. A request can take
up to 150 seconds; a browser visitor can require several such requests. Completed
records remain on disk. Partial visits may have already submitted dummy forms and
can be retried from a fresh context. Use disposable test data.

Reported input/output tokens and actual request attempts are shown. Failed calls
may still consume provider usage. Monetary AI charges are **unknown**; Hypothra
does not infer the price of a user's account or subscription. A CLI process can be
paused with Ctrl+C and resumed with the run command. A stale run lease is reclaimed
only when its recorded process is definitely gone. A crashed short-lived control
gate still requires inspection of the named lock file rather than unsafe removal.

Every run retains `state.json`, its plan, individual audience batches and individual
browser visits under `.hypothra/rehearsal-<run-id>/`. The current pointer is
`.hypothra/rehearsal.json`. Writes are atomic. A batch written just before a crash
is recovered rather than counted twice or sent back to AI. Source/model revisions
are checked; changing the product requires a new rehearsal.

## Cost provenance and uncertainty

AI-generated costs and budget are editable estimates. A published CPM retains its
URL, dates, currency and source scope. Arithmetic translates that CPM into a price
reference for the proposed number of exposures; it does not generate audience
decisions. Unavailable sources remain unknown, with no invented published prices.
Global benchmarks do not guarantee a local campaign's auction price.

The current creative input is a **script or description**. Hypothra has not watched
a real reel, heard its audio, reproduced a platform's delivery algorithm or measured
ad fatigue. Video upload/multimodal evaluation, empirical calibration against real
small campaigns, native mobile exploration and concurrent load tests remain future
work. More synthetic decisions reduce neither systematic model bias nor missing
source context. Do not label their ratios as measured marketing effectiveness or
attach statistical population confidence intervals.

## CLI

```powershell
node D:\Hypothra\packages\cli\dist\index.js rehearse prepare D:\MyTestProject --viewers 20 --max-ai-calls 100
node D:\Hypothra\packages\cli\dist\index.js rehearse run D:\MyTestProject --max-ai-calls 100
node D:\Hypothra\packages\cli\dist\index.js rehearse status D:\MyTestProject
node D:\Hypothra\packages\cli\dist\index.js rehearse experience D:\MyTestProject --url http://127.0.0.1:3000/ --users 5 --synthetic-test-data
node D:\Hypothra\packages\cli\dist\index.js rehearse run D:\MyTestProject --max-ai-calls 200
```

The bound MCP host can read `get_virtual_launch` and
`get_virtual_audience_batch`. These tools do not silently start paid inference or
browser actions. Start jobs in the local panel or CLI.
