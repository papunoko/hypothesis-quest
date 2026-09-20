/**
 * 行動シグナルの固定セットを実 Jev に読ませ、支援種別の判定を記録する。
 *   node --env-file=.dev.vars scripts/harness/support-probe.mts [--repeat 2]
 * 出力: docs/eval/support-probe-<date>.md（追記しない。日付ごとに1ファイル）
 */
import { writeFileSync } from "node:fs";
import { readSupport, shouldOffer, type SupportSignals } from "../../src/lib/support.ts";

const s = (v: Partial<SupportSignals>): SupportSignals => ({ secondsOnCase: 40, secondsSinceInput: 40, inputChars: 0, scrollCount: 1, scrollDepth: 0.2, pointerMoves: 8, casesSeen: 1, submissions: 0, readingReady: false, focused: true, ...v });
const CASES: { name: string; expect: string; signals: SupportSignals }[] = [
  { name: "表示直後", expect: "none", signals: s({ secondsOnCase: 4, secondsSinceInput: 4 }) },
  { name: "打っている最中", expect: "none", signals: s({ secondsOnCase: 60, secondsSinceInput: 3, inputChars: 18 }) },
  { name: "読み進めている（スクロール継続）", expect: "none", signals: s({ secondsOnCase: 30, scrollCount: 14, scrollDepth: 0.7, pointerMoves: 40, focused: false }) },
  { name: "空欄のまま45秒", expect: "start", signals: s({ secondsOnCase: 45, secondsSinceInput: 45 }) },
  { name: "空欄で2分・フォーカスなし", expect: "start", signals: s({ secondsOnCase: 120, secondsSinceInput: 120, pointerMoves: 3, focused: false }) },
  { name: "8文字で40秒止まる（未読）", expect: "stuck", signals: s({ secondsOnCase: 70, secondsSinceInput: 40, inputChars: 8 }) },
  { name: "一文あり・読み取り済み・30秒", expect: "send", signals: s({ secondsOnCase: 90, secondsSinceInput: 30, inputChars: 22, readingReady: true }) },
  { name: "空欄で深くスクロール（探し中）", expect: "explore", signals: s({ secondsOnCase: 75, secondsSinceInput: 75, scrollCount: 22, scrollDepth: 0.95, pointerMoves: 60, focused: false }) },
  { name: "3事例目・2回送信済み・空欄50秒", expect: "start", signals: s({ secondsOnCase: 50, secondsSinceInput: 50, casesSeen: 3, submissions: 2 }) },
];
const repeat = Number(process.argv[process.argv.indexOf("--repeat") + 1]) || 1;
const rows: string[] = [];
let agree = 0;
for (const c of CASES) {
  const runs = [] as Awaited<ReturnType<typeof readSupport>>[];
  for (let i = 0; i < repeat; i++) runs.push(await readSupport(c.signals));
  // 一致の基準は「出すか・何を出すか」。none 期待なら出ないこと、それ以外なら期待の種別で出ること
  const kinds = runs.map((r) => shouldOffer(r, c.signals) ? r.kind : "none");
  const ok = kinds.every((k) => k === c.expect);
  if (ok) agree++;
  rows.push(`| ${c.name} | ${c.expect} | ${runs.map((r) => `${r.kind} ${r.confidence.toFixed(2)} / paused ${r.paused.toFixed(2)}${shouldOffer(r, c.signals) ? " ●" : ""}`).join("<br>")} | ${ok ? "○" : "✗"} |`);
  console.log(c.name, kinds.join(","), ok ? "○" : "✗");
}
const date = new Date().toISOString().slice(0, 10);
const out = `docs/eval/support-probe-${date}.md`;
writeFileSync(out, `# support-probe ${date}\n\n実 Jev（jev-latest）に固定シグナル ${CASES.length} 件を ${repeat} 回ずつ読ませた。期待は設計者の想定であって正解ラベルではない。● は shouldOffer（paused≥0.6 かつ 種別確率≥0.5、none 以外。explore は事例表示60秒以降）。一致は「出すか・何を出すか」で見る（kind の生値ではない）。\n\n| 状況 | 期待 | 判定 kind 確率 / paused | 一致 |\n| --- | --- | --- | --- |\n${rows.join("\n")}\n\n一致 ${agree}/${CASES.length}。実行: \`node --env-file=.dev.vars scripts/harness/support-probe.mts --repeat ${repeat}\`\n`);
console.log("wrote", out, `${agree}/${CASES.length}`);
