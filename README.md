# 最新家電・家具ブログ

最新の家電・家具に関する情報を毎日1記事ずつ書き溜めていくブログの原稿置き場です。

## 運用ルール

- 1日1記事、`posts/` フォルダに Markdown ファイルとして追加する。
- ファイル名は `YYYY-MM-DD-slug.md` 形式。
- 各記事の冒頭に frontmatter を付け、`sources`(出典)を必ず明記する。
- 本文・画像は一次情報(公式サイト・プレスリリース・報道)を自分の言葉で要約したもののみを使う。他サイトの文章や画像をそのまま転載しない。
- 画像を使う場合は自作、または各社公式サイトが配布・許諾している素材のみを使用し、キャプションに出典を記載する。
- 最新ニュースだけでなく、時には発売から時間が経った有名な定番商品(ロングセラー家電・名作家具など)も取り上げてよい。

## フォルダ構成

- `posts/` … 公開済み・執筆済みの記事本体
- `TOPICS.md` … 記事ネタのバックログ(候補と消化状況)

## 次の一歩(任意)

現状はローカルのMarkdown蓄積のみ。将来的にサイトとして公開したくなったら、Next.js + Vercelでのブログサイト化を検討する。

## Instagram自動投稿

`posts/`に追加された記事から未投稿のものを1件選び、アイキャッチ画像を自動生成してInstagramに投稿する仕組みです。GitHub Actionsで毎日自動実行されます(`.github/workflows/instagram-daily.yml`、JST 12:00)。

### 仕組み

1. `posts/*.md`をfrontmatterの`date`順に読み込み、`instagram_posted: true`が付いていない最初の記事を選ぶ
2. `scripts/generate-image.mjs`でタイトル・カテゴリ・日付を使った1080x1080のアイキャッチ画像を自動生成(`assets/instagram/`に保存)
3. 画像をコミット・pushし、`raw.githubusercontent.com`のURLを取得(Instagram Graph APIは画像を公開URLから取得するため)
4. Instagram Graph APIでメディアコンテナ作成→公開
5. 投稿した記事のfrontmatterに`instagram_posted: true`を追記してコミット

キャプションは記事の本文冒頭と「一言メモ」セクション、カテゴリ・タグから作ったハッシュタグを組み合わせて自動生成します。

### 必要な準備(ユーザー側)

1. InstagramをビジネスアカウントにしてFacebookページと連携
2. https://developers.facebook.com/apps/ でアプリを作成し、Instagram Graph APIを追加
3. Graph API Explorerで`instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`権限のトークンを発行し、長期トークン(60日)に変換
4. リポジトリの Settings → Secrets and variables → Actions で以下を登録
   - `IG_ACCESS_TOKEN`: 上記の長期アクセストークン
   - `IG_BUSINESS_ACCOUNT_ID`: InstagramビジネスアカウントのID

トークンは60日で失効するため、期限が近づいたら再発行してSecretsを更新してください。

### ローカルでのテスト

```
npm install
npm run post-to-instagram:dry-run   # 実際には投稿・pushせず、画像生成とキャプションのみ確認
npm run post-to-instagram           # 本番実行(要:環境変数 IG_ACCESS_TOKEN, IG_BUSINESS_ACCOUNT_ID)
```

GitHub Actionsは「Actions」タブから`Daily Instagram Post`を選び、`Run workflow`で`dry_run: true`にすると同様に安全にテストできます。
