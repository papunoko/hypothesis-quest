# 題材検査 lru-cache 2026-09-20T13-49-50-285Z

矛盾:
> f(1) のあとに f(1.0) を呼ぶと、もう一度計算する。
> f(1, 2) のあとに f(1.0, 2) を呼ぶと、記憶した結果を返す。

| 検査 | 結果 | 詳細 |
| --- | --- | --- |
| truth-passes-all | ○ | 7/7 一致 / 読み: {"rule":0.97,"form":0.89,"order":0.91,"types":0.42,"singleFast":0.94,"typed":0.97} |
| expectation-splits-pair | ○ | L5:mismatch, L6:match（全体の食い違い 4/7） |
| paradox-hides-cause | ○ | cause=0.15（< 0.30） |
| paradox-reads-as-puzzle | ○ | puzzle=0.85（≥ 0.60） |
| paradox-provokes-questions | ○ | `f(1)` の後に `f(1.0)` を呼んだ際、なぜキャッシュが利用されなかったのでしょうか。 / `f(1, 2)` の後に `f(1.0, 2)` を呼んだ際は、なぜキャッシュが利用されたのでしょうか。 / 引数の数（1つか2つか）によって、型の扱いに関する挙動が変わっているのでしょうか。 |
