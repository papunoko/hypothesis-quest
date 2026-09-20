# subject:mine / subject:rank 初回の実走（2026-09-20）

`gh auth login` 済みのトークン（`GITHUB_TOKEN="$(gh auth token)"`）で python/cpython を掘り、Jev で順位付けした。表は `subject-rank-python-cpython-2026-09-20.md`、候補本文は `subject-candidates/*.jsonl`。

## 走らせたもの

| 段 | コマンド | 結果 |
| --- | --- | --- |
| 収集 | `subject:mine -- --repo python/cpython --limit 40`（既定の `is:issue is:closed reason:"not planned" comments:>=2`、コメント数降順） | 40 件。起票 2005〜2025、2023 以前が 33 件 |
| 順位 | `subject:rank -- --in …/python-cpython.jsonl --top 15` | 40 件すべて読めた。1 位 #98801 0.72（GC のメモリリーク）、2 位 #69675 0.63 |
| 対照 | 既知の良題材 bpo-39554 = [#83735](https://github.com/python/cpython/issues/83735) を `--query 'is:issue "bugs.python.org/issue39554" in:body' --limit 1` で単独取得して rank | **0.74**（期待 0.34 / 意図 0.97 / 条件 0.96 / 最小対 0.93）。上位 40 件のどれよりも上 |

## 分かったこと

- 対照が 1 位に来るので、4 命題の幾何平均は「lru_cache 型の題材」を上に押す方向には効いている。ただし `expectation` が 0.34 と低い。報告者は「typed=False なのに区別される」と書いており期待は明らかだが、命題文が「期待と実際の対比が明示されている」を要求するので落ちる。命題を「報告者が想定していた挙動が読み取れるか」に緩めるか、`expectation` を幾何平均から外して別欄にするかは、候補を人が読んでから決める
- 既定クエリ（not planned・コメント多い順）は性能・環境・設計論争の issue が集まる。上位 15 のうち最小対を持つのは #82809（ctypes/AIX）、#137121（memcpy の 2^k+1）、#90716（基数変換）、#59586（BytesIO）で、いずれも環境やアルゴリズムの話で「入力の1点で挙動が変わる」型ではない。**bpo-39554 は `state_reason: completed` なので既定クエリでは出てこない**。「not a bug」系は completed で閉じられることも多い
- 次に試すクエリ: `is:issue is:closed "not a bug" in:comments`、`"working as intended"`、`"by design"`、`label:type-bug` との組み合わせ。ユーザーの条件（3 年以上前の issue）は `created:<2023-09-20` で検索側に入れられる

## 費用

Jev: 41 候補 × 1 リクエスト（4 命題）。GitHub: 検索 2 回、コメント取得 41 回（トークンあり）。
