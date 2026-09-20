/**
 * 事例カード（固定データ）。
 * 「実結果」は orders.test.ts で実行して一致を確認している。想像で書かない。
 */

export type Outcome = "created" | "same" | "rejected";

export const OUTCOME_LABEL: Record<Outcome | "undetermined", string> = {
  created: "新しく登録される（件数が1増える）",
  same: "前と同じ結果が返る（登録は増えない・成功扱い）",
  rejected: "拒否される（登録は増えない・エラー）",
  undetermined: "この仮説だけでは決まらない",
};

export type Step = { key: string | null; productId: string; qty: number; note?: string };

/** 最後の操作が直前の操作と比べてどの条件を満たすか（コード側で仮説を当てはめるための特徴） */
export type Features = { sameContent: boolean; sameKey: boolean; retry: boolean };

export type CaseCard = {
  id: string;
  title: string;
  situation: string;
  steps: Step[];
  features: Features;
  actual: { outcome: Outcome; count: number; status: number };
  companion: string;
  codeRef: string;
};

export const CASES: CaseCard[] = [
  {
    id: "C1",
    title: "初回の登録",
    situation: "はじめて注文を送る。",
    steps: [{ key: "K1", productId: "A", qty: 1 }],
    features: { sameContent: false, sameKey: false, retry: false },
    actual: { outcome: "created", count: 1, status: 201 },
    companion: "まずは普通に1件。ここは迷わないはず。",
    codeRef: "orders.ts: create() 末尾の push",
  },
  {
    id: "C2",
    title: "同じ依頼の再送",
    situation: "通信が途切れたので、クライアントがまったく同じリクエストをもう一度送る。",
    steps: [
      { key: "K1", productId: "A", qty: 1 },
      { key: "K1", productId: "A", qty: 1, note: "同じ依頼IDで再送" },
    ],
    features: { sameContent: true, sameKey: true, retry: true },
    actual: { outcome: "same", count: 1, status: 200 },
    companion: "再送されても増えなかった。何を見て「同じ」と判断した？",
    codeRef: "orders.ts: this.keys.get(idempotencyKey)",
  },
  {
    id: "C3",
    title: "意図して2件目を注文",
    situation: "同じ商品を、別の注文としてもう1件買いたい。",
    steps: [
      { key: "K1", productId: "A", qty: 1 },
      { key: "K2", productId: "A", qty: 1, note: "新しい依頼IDで送る" },
    ],
    features: { sameContent: true, sameKey: false, retry: false },
    actual: { outcome: "created", count: 2, status: 201 },
    companion: "商品は同じなのに増えた。「同じ」の基準は商品じゃないらしい。",
    codeRef: "orders.ts: keys に K2 がないので新規作成",
  },
  {
    id: "C4",
    title: "同じ依頼IDで中身が違う",
    situation: "依頼IDを使い回したまま、商品だけ変えて送ってしまった。",
    steps: [
      { key: "K1", productId: "A", qty: 1 },
      { key: "K1", productId: "B", qty: 1, note: "同じ依頼ID、商品だけ違う" },
    ],
    features: { sameContent: false, sameKey: true, retry: false },
    actual: { outcome: "rejected", count: 1, status: 409 },
    companion: "増えなかったけど、成功でもない。この違いは今の説明に入ってる？",
    codeRef: "orders.ts: seen.fingerprint !== fingerprint → 409",
  },
  {
    id: "C5",
    title: "再送のたびに依頼IDを作り直す",
    situation: "通信が途切れたので再送した。ただしクライアントは再送のたびに依頼IDを新しく作っている。",
    steps: [
      { key: "K3", productId: "A", qty: 1 },
      { key: "K4", productId: "A", qty: 1, note: "同じ注文の再送だが、IDを作り直した" },
    ],
    features: { sameContent: true, sameKey: false, retry: true },
    actual: { outcome: "created", count: 2, status: 201 },
    companion: "再送なのに2件になった。守りたかったことは、誰がIDを発行するかに懸かっていた。",
    codeRef: "orders.ts: サーバーは依頼IDの出所を知らない",
  },
  {
    id: "C6",
    title: "依頼IDを付けずに再送",
    situation: "ヘッダーを付け忘れたクライアントが、同じリクエストを2回送る。",
    steps: [
      { key: null, productId: "A", qty: 1 },
      { key: null, productId: "A", qty: 1, note: "依頼IDなしで再送" },
    ],
    features: { sameContent: true, sameKey: false, retry: true },
    actual: { outcome: "created", count: 2, status: 201 },
    companion: "IDが無いと、サーバーには再送と新規の区別がつかない。",
    codeRef: "orders.ts: idempotencyKey === undefined の経路",
  },
];

/** 6事例では確認していない論点。終了時に「未確認」として残す */
export const UNEXPLORED: string[] = [
  "別の顧客が偶然同じ依頼IDを使ったら",
  "依頼IDの記録に有効期限はあるか",
  "サーバーを再起動して依頼IDの記録が消えたら",
  "qty だけ違う再送は「中身が違う」に入るか",
];
