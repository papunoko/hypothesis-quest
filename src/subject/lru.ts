/** Fixed observations from CPython 3.12.3; reproduced by scripts/verify-lru.py. */
export type LruOutcome = "remembered" | "computed" | "error";
export type LruFeatures = { form: boolean; order: boolean; types: boolean; singleFast: boolean; typed: boolean };
export type LruCase = {
  id: string; title: string; situation: string; calls: string[]; typed: boolean;
  features: LruFeatures; actual: LruOutcome; observation: string; companion: string;
  evidence: { title: string; url: string; code: string; line: number };
};
export const LRU_LABEL = {
  remembered: "記憶した結果を返す", computed: "もう一度計算する", error: "エラーになる",
  undetermined: "この仮説ではまだ決まらない",
};
export const LRU_SOURCE = "https://github.com/python/cpython/blob/v3.12.3/Lib/functools.py";
const features = (value: Partial<LruFeatures> = {}): LruFeatures => ({ form: true, order: true, types: true, singleFast: false, typed: false, ...value });
const evidence = (issue: number, code: string, line: number) => ({ title: `bpo-${issue}`, url: `https://bugs.python.org/issue${issue}`, code, line });
export const LRU_CASES: LruCase[] = [
  { id: "L1", title: "まったく同じ呼び出し", situation: "同じ関数を、同じ書き方でもう一度呼びます。", calls: ["f(1)", "f(1)"], typed: false, features: features(), actual: "remembered", observation: "関数の本体が動いたのは合計1回。2回目は保存した結果を返しました。", companion: "これが基準です。どこまで変えても「同じ」でしょう？", evidence: { title: "CPython 3.12.3", url: LRU_SOURCE, code: "key = make_key(args, kwds, typed)", line: 554 } },
  { id: "L2", title: "省略していた0を書く", situation: "yの初期値は0。省略しても、0を書いても、関数に渡るxとyの値は同じです。", calls: ["f(1)", "f(1, 0)"], typed: false, features: features({ form: false }), actual: "computed", observation: "本体が合計2回動きました。y=0を省略した呼び出しと、明示した呼び出しは別の記憶です。", companion: "計算に使う値は同じ。f(1) と f(1, 0) で違うのは何でしょう？", evidence: evidence(33774, "key = args", 466) },
  { id: "L3", title: "引数に名前を付ける", situation: "1を位置で渡す代わりに、x=1と名前を付けて渡します。", calls: ["f(1)", "f(x=1)"], typed: false, features: features({ form: false }), actual: "computed", observation: "本体が合計2回動きました。位置引数とキーワード引数は別に記録されます。", companion: "xに入る値はどちらも1。値を受け取る関数と、呼び出しを記録する仕組みでは、見ているものが違いそうです。", evidence: evidence(33774, "if kwds:\n    key += kwd_mark", 467) },
  { id: "L4", title: "名前付き引数の順番を入れ替える", situation: "xは5、yは6のまま。書く順番だけを入れ替えます。", calls: ["f(x=5, y=6)", "f(y=6, x=5)"], typed: false, features: features({ order: false }), actual: "computed", observation: "本体が合計2回動きました。キーワード引数の順番も記録に残ります。", companion: "同じ名前、同じ値。それでも別扱いになりました。2つの呼び出しで違うところは1つだけです。", evidence: evidence(29203, "for item in kwds.items():\n    key += item", 469) },
  { id: "L5", title: "1個の引数：1を1.0にする", situation: "Pythonでは1 == 1.0はTrue。でも、1はint、1.0はfloatという別の型です。", calls: ["f(1)", "f(1.0)"], typed: false, features: features({ types: false, singleFast: true }), actual: "computed", observation: "本体が合計2回動きました。typed=Falseでも、ここでは1と1.0は別扱いです。", companion: "では「型が違えばいつも別」で説明できるでしょうか。L6も比べてみましょう。", evidence: evidence(39554, "elif len(key) == 1 and type(key[0]) in fasttypes:\n    return key[0]", 475) },
  { id: "L6", title: "2個の引数：1を1.0にする", situation: "今度は2つ目の引数も渡します。1を1.0に変える点はL5と同じです。", calls: ["f(1, 2)", "f(1.0, 2)"], typed: false, features: features({ types: false }), actual: "remembered", observation: "本体が動いたのは合計1回。今度は1と1.0を含む引数の並びが等しいものとして扱われました。", companion: "今度は1.0なのに記憶を返しました。L5とL6で、変わったところを探してみてください。", evidence: evidence(39554, "return _HashedSeq(key)", 477) },
  { id: "L7", title: "typed=Trueを指定する", situation: "L6と同じ2つの呼び出しを、型も区別する設定typed=Trueで試します。", calls: ["f(1, 2)", "f(1.0, 2)"], typed: true, features: features({ types: false, typed: true }), actual: "computed", observation: "本体が合計2回動きました。typed=Trueでは、引数の型も記録に含まれます。", companion: "設定を1つ変えただけで、L6と結果が変わりました。この設定は、あなたの説明のどこに入りますか？", evidence: evidence(13227, "if typed:\n    key += tuple(type(v) for v in args)", 471) },
];
export const LRU_EXTRA = {
  id: "L8", call: "f([1])", title: "リストを渡すと？", actual: "error" as const,
  observation: "TypeError: unhashable type: 'list'。関数の本体が動く前にエラーになります。",
};
/** Held out of selection, question answers, and the seven-case clear condition. */
export const LRU_HOLDOUT: LruCase = {
  id: "H1", title: "最後にひとつ、別の事例で試す",
  situation: "同じ関数 f(x, y=0)、typed=False。新しいキャッシュで順に呼びます。2回目はどうなるでしょう？",
  calls: ["f(1.0)", "f(True)"], typed: false,
  features: features({ types: false }), actual: "remembered",
  observation: "関数の本体が動いたのは合計1回。2回目のf(True)は、f(1.0)で保存した結果を返しました。",
  companion: "",
  evidence: { title: "CPython 3.12.3（verify:lruで再現）", url: LRU_SOURCE, code: "return _HashedSeq(key)", line: 477 },
};
export const LRU_HOLDOUT_PROMPT = "f(1.0)の後のf(True)はどうなる？";
export const LRU_UNEXPLORED = [
  LRU_HOLDOUT_PROMPT, "文字列のサブクラスは同じ扱い？（bpo-44992）",
  "保存件数の上限を超えたら、何を忘れる？", "メソッドのselfも記憶の区別に含む？", "cache_clear()で消した後は？",
];

// Axes describe explicit claims, not topic mentions. Arity alone does not imply the fast path.
export const LRU_AXES = {
  rule: { label: "呼び出しを区別するルールを述べている", instructions: "Is `hypothesis` a proposed rule about function arguments, cached results, or cache keys?", criteria: { true: "Mentions 引数, 呼び出し, 計算結果, キャッシュ, or cache keys and proposes how they are compared or reused.", false: "Unrelated topic such as product/order registration, or says only I don't know. No rule about function calls." } },
  form: { label: "省略・位置・名前の書き方を区別する", instructions: "Does `hypothesis` explicitly say that how arguments are written affects whether two calls are the same?", criteria: { true: "Explicitly mentions 書き方, 位置引数/キーワード引数, デフォルト値の省略, or 引数の並びをそのまま鍵にする.", false: "No syntax is named. 同じ引数 and 同じ値 alone mean values, not syntax. Only type or keyword order is named, or syntax explicitly does not matter." } },
  order: { label: "名前付き引数の順番を区別する", instructions: "Does `hypothesis` explicitly say that keyword argument order matters?", criteria: { true: "Explicitly says 順番まで同じ, 順番を区別する, 順番が違えば別, or 引数の並びをそのまま鍵にする.", false: "No order claim, including 同じ引数 or 同じ書き方 alone. Also false if explicitly says order does not matter." } },
  types: { label: "型が違えば常に別の呼び出し", instructions: "Does `hypothesis` assert a general rule that different argument types mean different calls?", criteria: { true: "型まで同じなら, 型が違えば別, 1と1.0は別. Matching types is a condition for reusing results.", false: "Types are absent or ignored. A rule ONLY about typed=True or a single-argument special case is not a general matching requirement. Explicitly saying 1と1.0（intとfloat）は同じ呼び出し or typed=Falseなら型は関係ない is false: matching types is not required." } },
  singleFast: { label: "int・strが1個だけの特例がある", instructions: "Does `hypothesis` describe the special key rule for a single positional int or str argument?", criteria: { true: "A single int/str argument is its own key, unlike a sequence of multiple arguments. Or explicitly says 1 and 1.0 differ with one argument but are equal with two.", false: "Only says argument count matters without describing the rule, or a blanket type rule. No specific single-argument exception." } },
  typed: { label: "typed=Trueのとき型を区別する", instructions: "Does `hypothesis` say that setting typed=True makes argument types part of call identity?", criteria: { true: "Explicitly names typed=True (or 型を区別する設定) and says types distinguish calls in that setting.", false: "No mention of the setting, or explicitly says the setting does not distinguish types." } },
} as const;
export type LruAxis = keyof typeof LRU_AXES;
export type LruReading = Record<LruAxis, number>;
