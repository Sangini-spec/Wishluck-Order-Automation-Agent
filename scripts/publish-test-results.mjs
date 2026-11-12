import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root=fileURLToPath(new URL("../",import.meta.url));
const read=path=>JSON.parse(readFileSync(resolve(root,path),"utf8"));
const unit=read("docs/test-output/backend-tests.json"),evaluation=read("generated-artifacts/agent-evaluation.json");
if(evaluation.results.length!==evaluation.total || unit.cases.length!==unit.total)throw new Error("Incomplete results; refusing to publish.");
// Publish factual verdicts and explanations without conversation/customer identifiers.
const agent={...evaluation,results:evaluation.results.map(({conversationId,fixtureOrderId,response,...result})=>result)};
mkdirSync(resolve(root,"docs/test-output"),{recursive:true});
writeFileSync(resolve(root,"docs/test-output/agent-evaluation.json"),JSON.stringify(agent,null,2)+"\n");
const yes=b=>b?"PASS":"FAIL",percent=n=>(n*100).toFixed(1)+"%";
const cell=value=>String(value??"—").replaceAll("|","\\|").replaceAll("\n"," ");
const markdown=`# Test results — Wishluck

[Back to README](../README.md) · [Detailed agent report](current-agent-evaluation.md) · [Backend script output](test-output/backend-tests.txt) · [Agent JSON](test-output/agent-evaluation.json) · [Backend JSON](test-output/backend-tests.json)

## Results at a glance

| Suite | Result | Recorded at (UTC) | What it verifies |
| --- | --- | --- | --- |
| Backend automated tests | **${unit.passed}/${unit.total} passed**, ${unit.failed} failed | ${unit.recordedAt} | Deterministic policy, consent, ownership, data integrity, checkout, queue, analytics, webhook and courier checks |
| Full actual-agent evaluation | **${agent.passed}/${agent.total} passed**, ${agent.total-agent.passed} failed | ${agent.recordedAt} | Actual model replies, tool use, stored outcomes, privacy, grounding and language; includes all 12 Appendix B cases |

These are separate suites, not ${unit.total+agent.total} identical tests. Counts below are generated from actual execution events/results, not entered by hand.

## Actual-agent measurements

| Measure | Recorded result |
| --- | ---: |
| Model | ${agent.model} |
| Intent checks | ${percent(agent.intentAccuracy)} |
| Tool-path checks | ${percent(agent.toolAccuracy)} |
| Policy/outcome checks | ${percent(agent.policyOutcomeAccuracy)} |
| Grounding checks | ${percent(agent.groundingPassRate)} |
| Mean complete evaluation-case latency | ${agent.averageResponseMs} ms |
| p95 complete evaluation-case latency | ${agent.p95ResponseMs} ms |
| Agent input / output tokens | ${agent.inputTokens} / ${agent.outputTokens} |
| Estimated agent cost | $${agent.costEstimateUSD.toFixed(6)} USD |
| Separate grading-model cost estimate | $${agent.gradingCostEstimateUSD.toFixed(6)} USD |

Latency covers a complete case, which may include multiple turns and workflow actions; it is not time to first token. Costs are public-rate estimates, not invoices. See the [full evaluation report](current-agent-evaluation.md) for rates and limitations.

## Every actual-agent case

| # | Scenario | Overall | Intent | Tools | Stored state | Policy | Privacy | Grounded | Language | ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: |
${agent.results.map(r=>`| ${r.case} | ${cell(r.name)} | **${yes(r.pass)}** | ${yes(r.intentPass)} | ${yes(r.toolPass)} | ${yes(r.statePass)} | ${yes(r.policyPass)} | ${yes(r.privacyPass)} | ${yes(r.semantic.grounded)} | ${yes(r.semantic.languageCorrect)} | ${r.latencyMs} |`).join("\n")}

## Every backend test

| Test | Result | ms |
| --- | --- | ---: |
${unit.cases.map(c=>`| ${cell(c.name)} | ${yes(c.passed)} | ${c.durationMs?.toFixed(2)??"—"} |`).join("\n")}

## Why an earlier run showed 32/33

The earlier full run rejected an expired return correctly but failed the policy/grounding explanation check. Its eligibility tool combined two different reasons: the seven-day window was expired **or** delivery was not recorded. The assistant chose the expired-window explanation without an unambiguous supporting tool reason. This was a real explanation-quality failure, not an approved out-of-policy return.

The policy code now returns separate reasons for missing delivery, future delivery timestamps and genuinely expired delivery dates. The focused recheck passed both the eight-day and ten-day cases. The full run reported above is a new execution of all ${agent.total} cases, not an edited version of the old 32/33 result. Earlier results remain in Git history.

### A separate false-negative found during this review

A later full run at 2026-11-12T14:08:04.079Z passed both expired-return cases but reported 32/33 because the exchange-stock assertion demanded a separate \`check_inventory\` call. The agent had instead called \`evaluate_return_eligibility\`, which reads the same live inventory and returned the exact requested SKU/size with zero available stock. The response and persisted state were correct; its intent, policy, privacy, language and grounding checks all passed.

The evaluator now accepts either inventory tool path **only with successful, exact SKU/size, zero-stock evidence**. It still requires verification, no unauthorized request creation and all semantic/state checks. Eight regression tests reject wrong products, wrong variants, failed tools, positive stock, missing evidence and unrelated tools. Required tool calls elsewhere must also have succeeded. The evaluator now exits with a nonzero status on failures instead of reporting a successful process exit.

[Preserved earlier full-run JSON](test-output/pre-stock-evidence-evaluation.json) retains that failure and its original grading explanation. The current results above were generated by another complete run after the assertion correction; no old verdict was changed.

## Reproduce the output

\`\`\`sh
# Complete README setup first, using a demo database:
pnpm test:report
pnpm evaluate
pnpm report:publish
\`\`\`

The first command writes backend runner output and JSON in \`docs/test-output/\`. The second runs the actual model, writes local detailed artifacts under \`generated-artifacts/\` and refreshes \`docs/current-agent-evaluation.md\`. The last command generates this page and the shareable agent JSON from those results. It does not rerun or change verdicts.

The actual-agent evaluator uses paid model calls. Evaluation mutations use isolated order copies; original seeded orders are not changed. Marked evaluation records are excluded from live analytics. Do not run this against a production database.

## What these results do not prove

- A passing finite suite is not a guarantee that every future model response will be correct.
- Semantic grading uses a separate call to the same model family and is fallible.
- These reports do not claim real WhatsApp delivery, courier transport, payments or refunds.
- This run is not a new browser end-to-end test. Separate [NDR browser-audit evidence](ndr-end-to-end-audit.md) covers the previously verified automatic follow-up, retry, refusal/RTO and timed handover journeys.

Dataset hash: \`${agent.datasetHash}\`

Evaluation code hash: \`${agent.codeHash}\`
`;
writeFileSync(resolve(root,"docs/test-results.md"),markdown);
console.log(`Published backend ${unit.passed}/${unit.total} and agent ${agent.passed}/${agent.total} results to docs/test-results.md`);
