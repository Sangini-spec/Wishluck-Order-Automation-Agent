import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Node's test-runner events are the source of truth, not manually entered counts.
export default async function* reporter(events) {
  const startedAt=new Date().toISOString(),cases=[];
  for await (const event of events) {
    if (!["test:pass","test:fail"].includes(event.type) || event.data.details?.type==="suite") continue;
    const row={name:event.data.name,passed:event.type==="test:pass",durationMs:event.data.details?.duration_ms??null};
    if(!row.passed)row.failure=String(event.data.details?.error?.message??"Test failed");
    cases.push(row);
    yield `${row.passed?"PASS":"FAIL"} ${row.name}${row.durationMs!==null?` (${row.durationMs.toFixed(2)} ms)`:""}\n`;
  }
  const report={startedAt,recordedAt:new Date().toISOString(),command:"pnpm test:report",total:cases.length,
    passed:cases.filter(c=>c.passed).length,failed:cases.filter(c=>!c.passed).length,cases};
  const directory=fileURLToPath(new URL("../docs/test-output/",import.meta.url));
  mkdirSync(directory,{recursive:true});
  writeFileSync(resolve(directory,"backend-tests.json"),JSON.stringify(report,null,2)+"\n");
  const output=`Wishluck backend test output\nStarted: ${startedAt}\nCompleted: ${report.recordedAt}\nCommand: ${report.command}\n\n${cases.map(c=>`${c.passed?"PASS":"FAIL"} ${c.name} (${c.durationMs?.toFixed(2)??"unknown"} ms)${c.failure?`\n  ${c.failure}`:""}`).join("\n")}\n\nTests: ${report.total}\nPassed: ${report.passed}\nFailed: ${report.failed}\n`;
  writeFileSync(resolve(directory,"backend-tests.txt"),output);
  yield `\nTests: ${report.total}; passed: ${report.passed}; failed: ${report.failed}\nReport: docs/test-output/backend-tests.txt\n`;
}
