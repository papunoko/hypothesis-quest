# support-probe 2026-09-20

実 Jev（jev-latest）に固定シグナル 9 件を 2 回ずつ読ませた。期待は設計者の想定であって正解ラベルではない。● は shouldOffer（paused≥0.6 かつ 種別確率≥0.5、none 以外。explore は事例表示60秒以降）。一致は「出すか・何を出すか」で見る（kind の生値ではない）。

| 状況 | 期待 | 判定 kind 確率 / paused | 一致 |
| --- | --- | --- | --- |
| 表示直後 | none | none 0.44 / paused 0.08<br>none 0.50 / paused 0.08 | ○ |
| 打っている最中 | none | stuck 0.71 / paused 0.52<br>stuck 0.61 / paused 0.44 | ○ |
| 読み進めている（スクロール継続） | none | explore 0.97 / paused 0.76<br>explore 0.97 / paused 0.78 | ○ |
| 空欄のまま45秒 | start | start 0.83 / paused 0.72 ●<br>start 0.81 / paused 0.71 ● | ○ |
| 空欄で2分・フォーカスなし | start | start 0.89 / paused 0.92 ●<br>start 0.93 / paused 0.92 ● | ○ |
| 8文字で40秒止まる（未読） | stuck | stuck 0.85 / paused 0.88 ●<br>stuck 0.87 / paused 0.88 ● | ○ |
| 一文あり・読み取り済み・30秒 | send | send 0.84 / paused 0.84 ●<br>send 0.85 / paused 0.85 ● | ○ |
| 空欄で深くスクロール（探し中） | explore | explore 0.99 / paused 0.92 ●<br>explore 0.98 / paused 0.92 ● | ○ |
| 3事例目・2回送信済み・空欄50秒 | start | start 0.75 / paused 0.71 ●<br>start 0.84 / paused 0.74 ● | ○ |

一致 9/9。実行: `node --env-file=.dev.vars scripts/harness/support-probe.mts --repeat 2`
