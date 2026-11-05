import { exampleBenchmarks, rehearsalPlanSchema, viewerBatchSchema, browserDecisionSchema, optimizationSchema } from '@hypothra/product-lab';

export const plan = {
  name: 'Route product launch', productSummary: 'Save routes with a community.', audienceRationale: 'Compare motivated drivers with indifferent viewers.',
  segments: [{ id: 'drivers', label: 'Curious drivers', context: 'Planning a trip', motivation: 'Find routes', skepticism: 'Needs useful local content', share: 0.5 },
    { id: 'skeptics', label: 'Skeptical viewers', context: 'Scrolling for entertainment', motivation: 'Only stop for clear value', skepticism: 'Already has a map app', share: 0.5 }],
  creative: { hook: 'Find your next drive', script: 'Open a route, save it, go explore.', callToAction: 'Try the route app', promise: 'Keep useful routes together', format: 'script-only', limitations: ['No real video or audio was inspected'] },
  costs: [{ item: 'Creative production', amount: 200, rationale: 'A synthetic AI planning estimate', basis: 'ai-estimate', evidenceIds: [] }],
  proposedBudget: 1500, budgetRationale: 'Unvalidated AI planning estimate', channels: [{ platform: 'tiktok', share: 1, benchmarkId: 'example-tiktok', rationale: 'Test a reel with interested viewers' }],
  uncertainties: ['Audience composition is synthetic and needs real-market calibration'],
};

export async function prices(currency) {
  const benchmarks = exampleBenchmarks(new Date().toISOString().slice(0, 10));
  for (const b of benchmarks) { b.currency = currency; b.source.type = 'public-benchmark'; b.source.url = 'https://example.com/synthetic-test-price'; b.source.label = 'Synthetic fixture, not a real market price'; }
  return { benchmarks, checkedAt: new Date().toISOString().slice(0, 10), sources: [], notes: [] };
}

export function viewer(assigned, index = Number(assigned.id.slice(1)) - 1) {
  return { ...assigned, profile: { context: `Synthetic visitor ${assigned.id}`, need: 'Find a useful route', objection: 'May already have a route planner', attention: index % 3 === 2 ? 'low' : 'high' },
    watch: index % 3 !== 2, click: index % 3 === 0, install: index % 3 === 0, reasonCode: index % 3 === 0 ? 'relevant' : 'irrelevant',
    reason: index % 3 === 0 ? 'This specific visitor wants to save routes.' : 'This specific visitor does not need another app now.', expectation: 'Create a test account and see useful routes.' };
}

export function fakeInference(hook) {
  const calls = [];
  const infer = async (schema, instructions, data) => {
    calls.push({ schema, instructions, data });
    let result = await hook?.(schema, data, calls.length);
    if (result === undefined) {
      if (schema === rehearsalPlanSchema) result = structuredClone(plan);
      else if (schema === viewerBatchSchema) result = { viewers: data.assigned.map(item => viewer(item)) };
      else if (schema === optimizationSchema) result = { summary: 'Test a clearer value proposition with real people.', recommendations: [{ priority: 'high', area: 'creative', change: 'Show a saved route in the hook', rationale: 'An individual synthetic visitor wants useful route evidence.', evidenceIds: [data.evidence[0].id], basis: data.evidence[0].basis }] };
      else if (schema === browserDecisionSchema) {
        const step = data.previousActions.length, observationId = data.currentObservation.id;
        result = { action: step === 0 ? 'fill' : step === 1 ? 'click' : 'finish', selector: step === 0 ? '#email' : step === 1 ? '#signup' : '', inputKind: step === 0 ? 'email' : 'none',
          reason: 'Try the observed signup form', verdict: step < 2 ? 'continue' : 'satisfied', feedback: 'The synthetic visitor reviewed the observed signup result.', evidenceIds: [observationId] };
      } else throw new Error('Unexpected inference task');
    }
    return { value: schema.parse(result), provider: 'controlled-test-provider', model: 'synthetic-fixture', usage: { inputTokens: 100, outputTokens: 50, cachedInputTokens: 0 } };
  };
  return { infer, calls };
}
