# Cloudflare Workers / ebiharadev.org

2026-09-20: **https://ebiharadev.org で公開済み**。Next.js + OpenNext + Workers + D1。既存DNSを維持してWorker Routeを追加。

- Worker: `hypothesis-quest`
- D1: `hypothesis-quest` / `37a3842d-0f56-4973-8a56-65e2d61c4bfb`
- 公開バージョン: `1027fad9-af84-4f0e-a956-cb42e1b285a6`
- 期限: **2026-10-01 00:00 JST**（9月30日いっぱい）。本番bindingも確認済み。

2026-09-20 夜の品質修正（F-01/F-02/F-03/H-08）は**ローカルのみ、未デプロイ**。Workerビルド・ローカルWorkerのPlaywright18件（実Jev/LLM5件を含む）通過。本番バージョン・期限・Route・Secretsに変更なし。

## 構成

- `wrangler.jsonc`: Worker `hypothesis-quest`、Worker Route `ebiharadev.org/*`（apexのみ）。既存のプロキシDNSを維持。workers.dev/プレビューURLは無効。
- `open-next.config.ts`: OpenNext変換。ISRを使わないためR2キャッシュは未使用。
- `DB`: D1。帳面と提出をセッション別に保存。リクエスト単位のD1セッションで読み書きの整合性を維持。
- `migrations/0001_notebook.sql`: 初期スキーマ。リクエスト中にはmigrationを実行しない。
- `JEV_API_KEY` / `OLLAMA_API_KEY`: Workers Secrets。`OLLAMA_MODEL` は非秘密の設定。
- `cloudflare-bindings.d.ts`: binding型のみimport。Workersとブラウザのグローバル型を混ぜない。

## 公開期間・停止の仕組み

- 公開期限: **2026年9月30日いっぱい（日本時間）**。`PUBLIC_UNTIL=2026-10-01T00:00:00+09:00`（UTCでは9月30日15:00）。ユーザーの依頼なしに延長・再公開しない。
- `custom-worker.ts` がNext.jsより先に日時を確認。期限以降は画面・静的ファイル・APIすべて410。期限設定が欠けたり不正なら閉じる。`assets.run_worker_first=true` で静的アセットからの迂回も防ぐ。
- 期限中のレスポンスもno-store。すでに開いた画面を消すことはできないが、期限後の新規API呼び出しは通さない。処理中だった外部API通信は完了し得るが、期限後に戻るアプリ応答は410へ置換する。
- Worker/DNS/D1/Secretsそのものは自動削除しない。終了ページの配信とデータ保管は残る。撤去・DB削除は別途ユーザー確認して行う。
- IP単位で入力読み取り（`/api/read` と、2026-09-20 深夜に追加した `/api/support`。どちらも Jev のみ）60回/分、その他POST API20回/分。`/api/support` は画面側で事例表示から15秒後、以後12秒以上の間隔、入力停止6秒未満は送らないので、1人あたり最大5回/分程度。Cloudflare拠点単位のレート制限で、世界全体の厳密な課金上限ではない。超過429、制限bindingの障害は503。公開は匿名。
- ローカルの `next dev` はこの外側のWorkerゲートを通らない。期限・制限の検証は `wrangler dev` / Workersで行う。

## ローカル開発

Node.js 22.18以降、npm。OpenNextはWindows完全対応ではない。問題が出る場合はWSL/Linuxで依存を入れ直してビルドする（Windowsのnode_modulesを流用しない）。

```powershell
npm ci
Copy-Item .dev.vars.example .dev.vars  # 初回のみ。既存ファイルを上書きしない
# .dev.vars に JEV_API_KEY / OLLAMA_API_KEY を入力
npm run dev                          # ローカルD1 migration → localhost:3002
npm run preview                      # 別途: build + Workers実行 → localhost:8787
```

このPCでは `.env.local` を `.dev.vars` へ移行済み。秘密値は表示・コミットしない。
OpenNextは `.env*` の値をWorkerへ埋め込む。APIキーは置かない。`build:worker` はprivate変数を含む `.env*` があると停止する。`NEXT_PUBLIC_*` は公開値に限定。

`npm start` はD1 bindingを作らないため、この構成には使わない。開発は `dev`、Workers検証は `preview` を使う。ローカルD1は `.wrangler/state`。以前の `data/notebook.sqlite` と退避DBは保持しているが、自動インポートしない。

## 初回の本番準備（実施済み・再構築用の記録）

1. `ebiharadev.org` が対象Cloudflareアカウントの有効なzoneか確認。既存apexサイト・Tunnel・DNSの切り替え影響も確認する。競合レコードを自動削除しない。
2. 認証しD1を作る。

```powershell
npx wrangler login
npx wrangler whoami
npx wrangler d1 create hypothesis-quest
```

3. 返されたUUIDで `wrangler.jsonc` の `database_id` を設定する。現在の本番IDと `account_id` は設定済み。既存DBを重複作成しない。
4. Secretsを対話入力で登録。値をコマンド引数・ログ・Gitへ出さない。Worker未作成ならWranglerの作成案内に従う。

```powershell
npx wrangler secret put JEV_API_KEY
npx wrangler secret put OLLAMA_API_KEY
```

## デプロイ

```powershell
npm test
npm run test:e2e
npm run deploy
```

`deploy` はD1仮ID検査 → Workerビルド → **本番D1 migration** → Worker公開・Route設定の順。実行すると `ebiharadev.org` の公開先が変わる。

最初のCustom Domain登録は既存DNSとの競合（100117）で拒否された。元はCloudflareの初期ページ。既存DNSを削除せず、プロキシ済みapexへWorker Routeを設定する方式へ変更した。証明書は既存zoneのものを使う。`www.ebiharadev.org` は今回含めない。ルートを削除すると旧公開先へ戻るため、期限終了時はルートを消すのではなくWorkerの410応答を維持する。

CIでは `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を登録。権限は対象Workers/D1/zoneに必要なものに限定する。AIキーはビルド時の.envではなくWorker Secretsへ。

## 検証

2026-09-20の確認: 単体31件・型チェック・Workerビルド、ローカルWorker UI12件、本番HTTPSの実Jev/LLM4件通過。公開期限後のローカル設定で画面・静的JS・APIすべて410、期限中は200/no-storeを確認した。本番のPUBLIC_UNTIL/Secrets/Route設定も読戻し確認済み。

```powershell
# 別ターミナルで npm run preview を起動してから
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:8787'
npx playwright test
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

UIテストは応答固定。liveは実Jev/Ollamaを呼び利用量が発生する。D1テストは隔離したローカルDBでセッション分離・重複挿入・ヒント更新・提出の同時再送を検証する。

公開後はHTTPS画面、質問→ヒント→提出→再読込、別ブラウザへの履歴非公開を確認。障害時は `npx wrangler tail`。入力やキーをログへ追加しない。

## 公開前の注意

- 認証・保持期間・削除UIは未実装。匿名公開なので第三者も有料AI APIを利用できる。レート制限はあるが、請求のハード上限ではない。
- Cookieを失うと履歴へアクセスできなくなるが、DBは自動削除されない。localhostのCookieも本番へは引き継がない。
- 旧DBのクラウド移行は別作業。利用者の入力を自動でアップロードしない。
- Workers/D1の利用枠、CPU/サイズ制限、課金は対象アカウントで確認する。

## 既存サブドメインの停止状況（2026-09-20）

仮説クエストの公開に伴い、ユーザーから既存の `amidakuji` と `dev` の一時停止依頼あり。apexの仮説クエストは引き続き公開する。

- `dev.ebiharadev.org`: `colab-ssh` TunnelのSSH向けhostname ingressを削除済み。remote config version 3は `http_status:404` のみ。Tunnel自体・DNS・既存Access・WARPは保持。匿名HTTPSでは既存Accessのログイン画面が表示されるが、Tunnel再起動だけで旧SSH経路は復活しない。
- **`amidakuji` は公開停止済み**。Accessアプリ `001678a3-28eb-4c27-b013-c81e55701f8d`（Paused amidakuji - 2026-09-20）を作成。`amidakuji.ebiharadev.org`・`amidakuji.pages.dev`・`*.amidakuji.pages.dev` を対象に、policy `1998e8f9-5a96-4b38-9c00-79222ae316df`（deny/everyone）のみを設定し読戻し確認。
- 検証: Playwrightの新規匿名contextで独自ドメイン・production pages.dev・既存deployment全3件（ec9c589e/c246cee1/c2db38da）の計5ホストを確認。各 `/`・`/favicon.ico`・`/api/` は302でAccessへ遷移し、ブラウザにもアプリではなくAccessログイン画面が出る。apexの仮説クエストはHTTPS 200を維持。Access設定直後には反映待ちの200があったため、再検証してから完了とした。
- 一時停止依頼なので、Pagesプロジェクト・ソース・既存deploymentは削除していない。独自ドメインを外すだけ、または停止ページを新規deployするだけでは、旧deployment URL経由の公開が残る。
- Wrangler 4.135.0のOAuthではAccess作成APIが403、`login --scopes-list` にAccess編集権限がないため、ユーザー提供の `Access: Apps and Policies Edit` カスタムAPIトークンで実施した。秘密値はリポジトリに保存していない。今回チャットに共有されたトークンはユーザーが失効させる。今後は短い有効期限と対象アカウント限定の権限にし、秘密値はチャット・Git・ビルド成果物へ出さない。
- 再公開はユーザーの明示依頼があるまで行わない。再公開時は停止用Accessアプリのポリシー・3宛先を確認する。`dev` はTunnelのSSH ingressを再設定しない限り復活しない。停止解除のために他アプリ（camerascan等）やapexの設定を変更しない。

## 公式資料

- [OpenNext設定](https://opennext.js.org/cloudflare/get-started)
- [Cloudflare OpenNextガイド](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [D1セットアップ](https://developers.cloudflare.com/d1/get-started/)
- [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [OpenNext環境変数](https://opennext.js.org/cloudflare/howtos/env-vars)
