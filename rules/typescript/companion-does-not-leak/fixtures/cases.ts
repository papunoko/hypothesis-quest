/** Cards shown one at a time. `observation` is the recorded result; `companion` is the voice beside it. */
export type Card = { id: string; calls: string[]; actual: "remembered" | "computed"; observation: string; companion: string };

export const CARDS: Card[] = [
  {
    id: "L1", calls: ["f(1)", "f(1)"], actual: "remembered",
    observation: "関数の本体が動いたのは合計1回。2回目は保存した結果を返しました。",
    companion: "これが基準です。どこまで変えても「同じ」でしょう？",
  },
  {
    id: "L2", calls: ["f(1)", "f(1, 0)"], actual: "computed",
    observation: "本体が合計2回動きました。y=0を省略した呼び出しと、明示した呼び出しは別の記憶です。",
    companion: "計算に使う値は同じ。それでも呼び出し方が違うと、もう一度計算しました。",
  },
  {
    id: "L4", calls: ["f(x=5, y=6)", "f(y=6, x=5)"], actual: "computed",
    observation: "本体が合計2回動きました。キーワード引数の順番も記録に残ります。",
    companion: "内部では引数をタプルにして鍵にしているので、順番が違えば別の鍵になります。",
  },
  {
    id: "L5", calls: ["f(1)", "f(1.0)"], actual: "computed",
    observation: "本体が合計2回動きました。typed=Falseでも、ここでは1と1.0は別扱いです。",
    companion: "では「型が違えばいつも別」で説明できるでしょうか。L6も比べてみましょう。",
  },
  {
    id: "L6", calls: ["f(1, 2)", "f(1.0, 2)"], actual: "remembered",
    observation: "本体が動いたのは合計1回。1と1.0を含む引数の並びが等しいものとして扱われました。",
    companion: "引数が1個のときだけ int を近道で鍵にするので、2個なら 1 と 1.0 は同じ鍵になります。",
  },
  {
    id: "L7", calls: ["f(1, 2)", "f(1.0, 2)"], actual: "computed",
    observation: "本体が合計2回動きました。typed=Trueでは、引数の型も記録に含まれます。",
    companion: "設定を変えると、2個の引数でも型を区別します。この設定まで説明に含められそうですか。",
  },
];

export const HINTS: Record<string, string[]> = {
  L2: ["2つの呼び出しを並べて、違う文字を探して", "値は両方 1 と 0", "書いたか、省略したか"],
  L5: ["1 == 1.0 は Python では True", "それでも計算した。値以外で違うものは？", "type(1) と type(1.0)"],
  L6: ["L5 と L6 を並べて、違うところを1つだけ探して", "違うのは引数の個数", "引数が1個のときだけ、特別な扱いがある"],
};

export const VOICE = {
  fallback: "場合によります。2枚を比べて、違いを1つ探してみてください。",
  note: "これは表示した比較テストでの答えです。あらゆる呼び出しについての保証ではありません。",
  unasked: "実際は引数が1個のときだけ 1 と 1.0 が区別されます。",
  split: "結果が分かれました。L5 では計算、L6 では記憶でした。",
};
