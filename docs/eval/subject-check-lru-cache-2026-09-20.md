# 題材検査 lru-cache 2026-09-20

矛盾:
> f(1) のあとに f(1.0) を呼ぶと、もう一度計算する。
> f(1, 2) のあとに f(1.0, 2) を呼ぶと、記憶した結果を返す。

| 検査 | 結果 | 詳細 |
| --- | --- | --- |
| truth-passes-all | ✗ | 一致しない: L6:undetermined / 読み: {"rule":0.97,"form":0.88,"order":0.91,"types":0.36,"singleFast":0.93,"typed":0.97} |
| expectation-splits-pair | ✗ | L5:undetermined, L6:undetermined（全体の食い違い 3/7） |
| paradox-hides-cause | ○ | cause=0.12（< 0.30） |
| paradox-reads-as-puzzle | ○ | puzzle=0.86（≥ 0.60） |
| paradox-provokes-questions | ○ | `f(1)` の後に `f(1.0)` を呼んだ際、なぜキャッシュが利用されなかったのでしょうか。 / `f(1, 2)` の後に `f(1.0, 2)` を呼んだ際は、なぜキャッシュが利用されたのでしょうか。 / 引数の数（1つか2つか）によって、キャッシュの判定基準が変わっているのでしょうか。 |
