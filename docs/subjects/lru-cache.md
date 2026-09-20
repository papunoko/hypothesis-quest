# 題材2: functools.lru_cache — 「この呼び出しは記憶に当たるか」

最終更新: 2026-09-20
位置づけ: **本番題材。** 注文登録API（題材1・[concept.md §4](../concept.md)）は骨格を作るための開発用ダミーで、デモはこちらで行う（2026-09-20 決定）。
載せ替えの残タスク: [backlog.md](../backlog.md) の T-60〜。
実測環境: CPython 3.12.3（WSL Ubuntu）。事例の結果はすべてこの環境で固定した。

---

## 1. なぜこの題材か

- 注文API（同じ依頼なら登録し直さない）と **同じ構造**（同じ呼び出しなら計算し直さない）。Choice の設計と事例選択ロジックをそのまま流用でき、2題材が対になる
- 事例8枚のうち6枚が、**2011〜2021年の本物のイシュー**に1対1で対応する。報告者の「期待」がプレイヤーの仮説、メンテナの返答が隠れたルールになっている（§5）
- コードに戻る先が **純Python 30行**（`Lib/functools.py` の `_make_key`）。最後の区別が `fasttypes = {int, str}` の1行に対応する

## 2. 題材の説明（プレイヤーに見せる世界）

```python
@functools.lru_cache(maxsize=None)
def f(x, y=0):
    ...  # 重い計算
```

`f` は以前の呼び出しを覚えていて、「同じ呼び出し」だと判断したら計算せず記憶を返す。

守りたいこと: **同じ計算を二度やらない。ただし、違う計算を同じだと誤解して間違った結果を返すのは困る。**

プレイヤーが書く仮説は「この仕組みは、何を"同じ呼び出し"とみなしているか」。

## 3. 事例カード（8枚・実測済み・JSONに固定）

各カードは **新しいキャッシュ** で、1回目の呼び出しのあとに2回目を行う。結果は2回目のもの。

| ID | 1回目 | 2回目 | 実際の結果 | 出典 |
| --- | --- | --- | --- | --- |
| **L1** | `f(1)` | `f(1)` | 記憶を返す（当たり） | 基準 |
| **L2** | `f(1)` | `f(1, 0)` デフォルト値を明示 | 計算する（外れ） | bpo-33774 |
| **L3** | `f(1)` | `f(x=1)` | 計算する（外れ） | bpo-33774 |
| **L4** | `f(x=5, y=6)` | `f(y=6, x=5)` | 計算する（外れ） | bpo-29203 |
| **L5** | `f(1)` | `f(1.0)` | 計算する（外れ） | bpo-39554 |
| **L6** | `f(1, 2)` | `f(1.0, 2)` | **記憶を返す（当たり）** | bpo-39554（作者の返答） |
| **L7** | `typed=True` で `f(1, 2)` | `f(1.0, 2)` | 計算する（外れ） | bpo-13227 |
| **L8** | — | `f([1])` | エラー（TypeError: unhashable） | — |

補助として実測した事実（カードには入れないが「根拠を見る」で出せる）:

| 呼び出し列 | 結果 |
| --- | --- |
| `f(1); f(True)` | 外れ |
| `f(1.0); f(True)` | **当たり**（`(True,) == (1.0,)` のため） |
| `f(x=1); f(x=1.0)` | 当たり |
| `f('a'); f('a')` | 当たり |

### 検証時の注意

**カードごとに新しいキャッシュで測ること。** 同じキャッシュを使い回すと、`f(1)` → `f(1.0)` → `f(True)` の順で `f(True)` が `f(1.0)` の記憶に当たり、「`f(1)` の記憶に当たった」と誤読する（初回調査で実際に起きた誤り）。

## 4. 仮説がどう壊れていくか

仮説は「何を同じとみなすか」の向きで書かせる。結果の軸は **4択**（§6）。

| プレイヤーが書きがちな仮説 | 破る事例 | 予想 → 実際 | そこで見えるもの |
| --- | --- | --- | --- |
| 「同じ引数で呼べば記憶を返す」 | **L2** | 当たり → 外れ | 値が同じでも、書き方（デフォルト省略）が違えば別扱い |
| 「同じ書き方で呼べば記憶を返す」 | **L4** | 当たり → 外れ | キーワード引数の **順番** まで書き方に含まれる |
| 「書き方も値も同じなら当たる（1 と 1.0 は別）」 | **L6** | 外れ → **当たり** | 1 と 1.0 は、引数が1個なら別、2個なら同じ。**同一視の基準が引数の個数で変わる** |
| 「等しい値なら当たる（1 == 1.0）」 | **L5** | 当たり → 外れ | 同上の裏面 |

L5 と L6 を **並べて見せる** のが山場。「1 と 1.0 が同じかどうか」がカードによって逆転する。ここで初めて「鍵は引数の並びそのもの。ただし int か str が1個だけのときは値をそのまま鍵にする」という一文に到達し、全8枚が通る。

想定する仮説の履歴:

```
最初：同じ引数なら計算しない
  ↓
次に：引数の書き方（位置・キーワード・順番）まで同じなら計算しない
  ↓
いま：引数の並びをそのまま鍵にする。ただし int か str が1個だけなら、その値自体が鍵
```

## 5. 出典イシュー（3年以上前の実イシュー）

すべて 2026-09 時点でページを取得して確認した。

| イシュー | 起票 | 報告者の期待 | メンテナの返答（要旨） | 結末 | 対応カード |
| --- | --- | --- | --- | --- | --- |
| [bpo-13227](https://bugs.python.org/issue13227) | 2011-10 | （機能要望）等しいが型の違う値を別々に記憶したい | `typed=True` を追加 | 採用 | L7 |
| [bpo-29203](https://bugs.python.org/issue29203) | 2017-01 | — | 「PEP 468 でキーワード順が保証されたので sorted() をやめる。`f(a=1, b=2)` と `f(b=2, a=1)` は別々に記憶される」 | 3.6/3.7 で変更 | L4 |
| [bpo-33774](https://bugs.python.org/issue33774) | 2018-06 | `function(1, 2, 3)` / `function(1, 2, c=3)` / `function(1, 2)` は同じ扱いのはず | 「引数パターンが違えば、関数側が同じ呼び出しとみなしても別の呼び出しとして扱ってよい」 | ドキュメント修正（PR 9298） | L2, L3 |
| [bpo-39554](https://bugs.python.org/issue39554) | 2020-02 | `typed=False` なら `func(1)` の後の `func(1.0)` は hit のはず | 「`typed=False` は同一視を**要求しない**。許すだけ。この自由度で int の省スペース経路を足した。代償として int/float の同値呼び出しが別扱いになる」（作者本人） | not a bug | L5, L6 |
| [bpo-44992](https://bugs.python.org/issue44992) | 2021-08 | `f('hello')` と `f(np.str_('hello'))` は等しくハッシュも同じなので hit のはず | ドキュメントの「usually but not always regard them as equivalent」を引用 | not a bug | 未探索（§7） |

bpo-39554 の返答の原文（引用）:

> Specifying 'typed=False' means that the cache isn't required to treat calls as distinct, but it is still allowed to. This flexibility allowed the tool to add a space saving path for *int*. It comes at the expense of leaving equivalent int/float calls as distinct.

## 6. Jev 呼び出し設計（題材1との差分）

題材1と同じく **1事例＝1リクエスト**、実際の結果は渡さない。

```
state:
  世界の説明（関数 f(x, y=0) は呼ぶと計算する。以前の呼び出しを覚えていて、
             「同じ呼び出し」と判断したら計算せず記憶を返す）
  「プレイヤーの仮説が、何を同じとみなすかの唯一のルールだとしたら」という枠組み
  プレイヤーの仮説（一文）
  1回目の呼び出し ＋ 2回目の呼び出し（結果は含めない）

question (Choice): 仮説を唯一のルールとして適用したとき、2回目の呼び出しはどうなる？
  criteria:
    remembered   — 計算せず、記憶した結果を返す
    computed     — 新しい呼び出しとして計算する
    error        — 呼び出し自体がエラーになる
    undetermined — 仮説はこの状況に触れているが、一通りに読めない
```

題材1で学んだ注意（concept.md §5）をそのまま適用する:

- **実装の手がかりになる語を Jev に見せない。** `lru_cache`・ハッシュ・キー・タプルという語は state に出さない。「記憶」「同じ呼び出し」と日本語で書く。出すと Jev が仮説ではなく lru_cache の一般知識で答える
- デフォルトを与える: 「仮説の条件に当てはまらなければ、新しい呼び出しとして計算する」

## 7. 未探索の論点（地図に最初から見せる）

- `f(1.0)` のあとの `f(True)`（bool は int の一種として等しい）
- 文字列のサブクラス（bpo-44992）
- `maxsize` を超えたときにどれが忘れられるか（LRU の順序）
- メソッドに付けたとき `self` は鍵に入るか
- `cache_clear()` / `cache_info()`

## 8. 根拠を見る — コードへ戻る導線

**戻り先: `Lib/functools.py` の `_make_key`（30行・純Python）。** 3.12 の実物:

```python
def _make_key(args, kwds, typed,
             kwd_mark = (object(),),
             fasttypes = {int, str},
             tuple=tuple, type=type, len=len):
    # All of code below relies on kwds preserving the order input by the user.
    # Formerly, we sorted() the kwds before looping.  The new way is *much*
    # faster; however, it means that f(x=1, y=2) will now be treated as a
    # distinct call from f(y=2, x=1) which will be cached separately.
    key = args
    if kwds:
        key += kwd_mark
        for item in kwds.items():
            key += item
    if typed:
        key += tuple(type(v) for v in args)
        if kwds:
            key += tuple(type(v) for v in kwds.values())
    elif len(key) == 1 and type(key[0]) in fasttypes:
        return key[0]
    return _HashedSeq(key)
```

発見した区別がどの行に表れているか:

| カード | 行 |
| --- | --- |
| L2, L3 | `key = args` / `key += item` — 鍵は「値の集合」ではなく「引数の並び」 |
| L4 | 冒頭のコメント（bpo-29203 の帰結がそのまま書いてある） |
| L5, L6 | `elif len(key) == 1 and type(key[0]) in fasttypes: return key[0]` — 1個の int/str だけ値そのもの。2個なら `(1, 2) == (1.0, 2)` で当たる |
| L7 | `if typed: key += tuple(type(v) ...)` |
| L8 | `_HashedSeq.__init__` の `hash(tup)` |

C実装（`Modules/_functoolsmodule.c` の `lru_cache_make_key`）も同じ形で、近道の条件は `PyUnicode_CheckExact(key) || PyLong_CheckExact(key)`。実測した8枚はC版・純Python版の両方で同じ結果になる（`_make_key` を直接呼んで確認済み）。

## 9. 検証スクリプト

```python
import functools

def fresh(typed=False):
    calls = []
    @functools.lru_cache(maxsize=None, typed=typed)
    def f(x, y=0):
        calls.append((x, y)); return x
    return f, calls

def run(label, seq, typed=False):
    f, calls = fresh(typed)
    out = []
    for args, kw in seq:
        n = len(calls)
        try:
            f(*args, **kw); out.append('computed' if len(calls) > n else 'remembered')
        except TypeError:
            out.append('error')
    print(f"{label:35s} {' -> '.join(out)}")

run("L1 f(1); f(1)",             [((1,),{}), ((1,),{})])
run("L2 f(1); f(1, 0)",          [((1,),{}), ((1,0),{})])
run("L3 f(1); f(x=1)",           [((1,),{}), ((),{'x':1})])
run("L4 f(x=5,y=6); f(y=6,x=5)", [((),{'x':5,'y':6}), ((),{'y':6,'x':5})])
run("L5 f(1); f(1.0)",           [((1,),{}), ((1.0,),{})])
run("L6 f(1, 2); f(1.0, 2)",     [((1,2),{}), ((1.0,2),{})])
run("L7 typed f(1, 2); f(1.0, 2)", [((1,2),{}), ((1.0,2),{})], typed=True)
run("L8 f([1])",                 [(([1],),{})])
```

実測出力（3.12.3）: L1 remembered / L2 computed / L3 computed / L4 computed / L5 computed / L6 remembered / L7 computed / L8 error。

## 10. 検討して外した題材

同じ基準（Python・実OSS・3年以上前のイシュー・小さな再実装）で調べた他の候補と、外した理由。

| 題材 | 根拠イシュー | 外した理由 |
| --- | --- | --- |
| argparse の前方一致と負数の扱い | bpo-10981 (2011), bpo-14910 (2012), bpo-9334 (2010) | 次点。結果が「どう解釈されたか」で Choice の選択肢が増える |
| packaging の `~=` とプレリリース | pip #3982 (2016)「PEP 440 は SemVer ではない」, pip #1545 (2014) | packaging 26.3 で `>=1.0` がプレリリースを通すように変わった（25.0 までは除外）。事例がバージョン依存になる |
| http.cookiejar の Cookie 送信判定 | requests #2576 (2015→2024 wontfix), bpo-35121, bpo-35647 | 標準ライブラリがブラウザと逆（Domain 無しでもサブドメインに送る、Public Suffix List 無し）。最初の題材には混乱が大きい |
| datetime の naive/aware 比較 | bpo-15006 (2012) | `==` は False、`<` は TypeError の非対称は綺麗だが、カードが3〜4枚しか作れない |
| dataclasses の等価性 | ericvsmith/dataclasses #51 (2017) | サブクラス不等をユーザーが報告したイシューが見つからず根拠が弱い |
