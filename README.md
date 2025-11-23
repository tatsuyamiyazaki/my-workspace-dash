# Google Workspace 統合ダッシュボード (my-workspace-dash)

Google Workspaceの主要サービス（Gmail、Google Calendar、Google Tasks）を単一の画面（Single Pane of Glass）で閲覧・操作可能なWebアプリケーションです。
Next.js (App Router) と Firebase を使用して構築されており、バックエンドでのデータ同期は行わず、フロントエンドから直接各Google APIを参照することでリアルタイムかつセキュアな動作を実現しています。

## 機能

- **Gmail連携**: 受信トレイの一覧表示、詳細確認。
- **Google Calendar連携**: 今日の予定表示。
- **Google Tasks連携**: タスクリストの管理。
- **シングルサインオン**: Googleアカウントを使用したFirebase Authenticationによるログイン。

## 技術スタック

| カテゴリ | 技術要素 |
| :--- | :--- |
| **Frontend** | Next.js 15 (App Router), React, TypeScript, Tailwind CSS |
| **Auth** | Firebase Authentication (Google Sign-In) |
| **Database** | Cloud Firestore (ユーザー設定の保存のみ) |
| **Icons** | Lucide React |
| **Date Lib** | date-fns |

## セットアップ手順

詳細は [docs/setup.md](docs/setup.md) を参照してください。

### 1. 必須要件

- Node.js (LTS推奨)
- Google Cloud Platform プロジェクト
- Firebase プロジェクト

### 2. インストール

```bash
# 依存パッケージのインストール
npm install
```

### 3. 環境変数の設定

`.env.local` ファイルを作成し、FirebaseおよびGoogle APIの設定を記述します。

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. 開発サーバーの起動

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## ディレクトリ構造

```text
my-workspace-dash/
├── app/
│   ├── layout.tsx        # 全体のレイアウト
│   ├── page.tsx          # ログイン画面
│   └── dashboard/        # ダッシュボード画面 (要認証)
│       ├── page.tsx      # メイン表示
│       ├── _components/  # この画面専用のコンポーネント
│       │   ├── MailList.tsx
│       │   ├── CalendarView.tsx
│       │   └── TaskList.tsx
│       └── layout.tsx    # サイドバーなどを配置
├── lib/
│   ├── firebase.ts       # Firebase初期化とAuth設定
│   └── gmailApi.ts       # Gmail/Calendar等のAPIを叩く関数群
├── contexts/
│   └── AuthContext.tsx   # ログイン状態とアクセストークンを管理
└── .env.local            # 環境変数 (APIキーなど)
```

## ドキュメント一覧

詳細な仕様や実装方法については、以下のドキュメントを参照してください。

- [基本設計書 (Spec)](docs/spec.md): システム構成、技術選定、API設計について。
- [開発環境セットアップ (Setup)](docs/setup.md): プロジェクト作成からライブラリ導入、Firebase設定まで。
- [Gmail API使用方法](docs/gmail-api.md): メール取得ロジックと実装のポイント（N+1問題対策など）。

## ライセンス

MIT