# Cloudflare Tunnel で公開する

最終更新: 2026-09-20

このプロジェクトは、ローカルの Next.js 本番サーバーを `cloudflared` 経由で公開する。
Cloudflare Workers 上へ Next.js を配置する構成ではない。

```text
ブラウザ
  ↓ HTTPS
Cloudflare Tunnel
  ↓
cloudflared（公開元のPC）
  ↓ http://localhost:3000
Next.js（npm start）
  ↓ /api/predict
TypeSafe Jev API
```

`JEV_API_KEY` は公開元のPCにある `.env.local` だけに置く。ブラウザや Cloudflare に
キーを設定する必要はない。

## Wrangler は必要か

**Cloudflare Tunnel で公開するだけなら不要。** 使用するCLIは `cloudflared` だけ。

Wrangler は Workers の開発・設定・デプロイ用CLI。このプロジェクトを将来
Cloudflare Workers 上で常時稼働させる構成へ変更するときに導入を検討する。

## 前提

- Node.js と npm がインストール済み
- `cloudflared --version` が成功する
- プロジェクト直下の `.env.local` に `JEV_API_KEY` がある
- 公開元のPCから TypeSafe Jev API へ接続できる

`.env.local` の内容:

```dotenv
JEV_API_KEY=<your key>
```

`.env.local` は `.gitignore` の対象。値をREADME、ログ、Cloudflareの公開設定へ貼らない。

## ハッカソン用: Quick Tunnel

一時的なデモには Quick Tunnel を使う。Cloudflare のドメイン設定は不要で、
ランダムな `trycloudflare.com` URL が発行される。

### 1. ビルドを確認する

```powershell
npm ci
npm test
npm run build
```

### 2. Next.js を起動する

ターミナルを開いたままにする。

```powershell
npm start
```

`http://localhost:3000` を開き、画面が表示されることを確認する。

### 3. Tunnel を起動する

別のターミナルで実行し、表示された HTTPS URL を共有する。

```powershell
cloudflared tunnel --url http://localhost:3000
```

シェルを再起動するまで `cloudflared` が見つからない場合:

```powershell
& 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel --url http://localhost:3000
```

### 4. 公開を終了する

`cloudflared` と `npm start` の両方を `Ctrl+C` で終了する。Quick Tunnel のURLは
次回の起動時に変わる。

## 固定URLが必要な場合: Named Tunnel

独自ドメインを Cloudflare で管理している場合は、Named Tunnel と DNS ルートを使う。
この方法でも Wrangler は不要。

### 1. 認証してTunnelを作る

```powershell
cloudflared tunnel login
cloudflared tunnel create hypothesis-quest
cloudflared tunnel list
```

作成時に表示される Tunnel UUID と認証JSONのパスを控える。

### 2. `%USERPROFILE%\.cloudflared\config.yml` を作る

```yaml
url: http://localhost:3000
tunnel: <TUNNEL-UUID>
credentials-file: C:/Users/<USER>/.cloudflared/<TUNNEL-UUID>.json
```

`<TUNNEL-UUID>` と `<USER>` は実際の値に置き換える。このファイルと認証JSONは
リポジトリへ追加しない。

### 3. DNSを割り当てる

```powershell
cloudflared tunnel route dns hypothesis-quest demo.example.com
```

`demo.example.com` は Cloudflare で管理している実際のホスト名に置き換える。

### 4. Next.js とTunnelを起動する

ターミナル1:

```powershell
npm start
```

ターミナル2:

```powershell
cloudflared tunnel run hypothesis-quest
```

DNSレコードはTunnelを止めても残る。Tunnel停止中にアクセスすると Cloudflare の
エラーになるため、デモ終了後に不要ならDNSルートも整理する。

## この公開方法の制約

- 公開元のPC、`npm start`、`cloudflared` の3つが動いている間だけ利用できる
- Quick Tunnel は開発・テスト向けで、常時運用には使わない
- URLを知っている人は画面と `/api/predict` にアクセスでき、Jev APIの利用量が発生する
- 常時運用するなら、Next.js と `cloudflared` を常時稼働するサーバーへ移すか、Workers向け構成を別途設計する

## トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| `cloudflared` が見つからない | 新しいPowerShellを開く。直らなければ上記のフルパスで実行する |
| Tunnel URL が 502 | `npm start` が起動中か、`http://localhost:3000` が開けるか確認する |
| `/api/predict` が失敗 | `.env.local` の `JEV_API_KEY` と、起動したターミナルのログを確認する |
| Quick Tunnel が設定エラー | `%USERPROFILE%\.cloudflared` に既存の `config.yml` / `config.yaml` がないか確認する |
| 固定URLがつながらない | `cloudflared tunnel info hypothesis-quest` と DNS ルートを確認する |

## 公式資料

- [Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)
- [Locally-managed tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/)
- [Tunnel DNS records](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/dns/)
