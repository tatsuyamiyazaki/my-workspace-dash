# 開発環境セットアップ手順

## 1\. プロジェクト作成とライブラリのインストール

ターミナル（コマンドプロンプト）を開き、以下のコマンドを順番に実行してください。今回は最新の **App Router** を採用します。

```bash
# 1. Next.jsプロジェクトの作成 (設定はすべてYes/DefaultでOK)
npx create-next-app@latest my-workspace-dash --typescript --tailwind --eslint

# 2. プロジェクトフォルダへ移動
cd my-workspace-dash

# 3. 必須ライブラリのインストール
# firebase: 認証とDB用
# lucide-react: アイコン用（ダッシュボードで見栄えが良い）
# date-fns: 日付操作用（カレンダー機能で必須）
npm install firebase lucide-react date-fns
```

## 2\. ディレクトリ構造の提案

Next.jsの `app` ディレクトリを使った、メンテナンスしやすい構成案です。

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
│   └── googleApi.ts      # Gmail/Calendar等のAPIを叩く関数群
├── contexts/
│   └── AuthContext.tsx   # ログイン状態とアクセストークンを管理
└── .env.local            # 環境変数 (APIキーなど)
```

## 3\. 最重要：認証とスコープ設定の実装 (`lib/firebase.ts`)

ここが普通のFirebaseアプリと違う点です。**「Gmailやカレンダーを見せてね」という許可（スコープ）** を追加する必要があります。

`lib/firebase.ts` を作成し、以下のように記述します。

```typescript
// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebaseアプリの初期化
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Googleプロバイダの設定 (ここが重要！)
export const googleProvider = new GoogleAuthProvider();

// 必要な権限(スコープ)を追加
googleProvider.addScope('https://www.googleapis.com/auth/gmail.modify');
googleProvider.addScope('https://www.googleapis.com/auth/calendar');
googleProvider.addScope('https://www.googleapis.com/auth/tasks');
```

## 4\. ログイン処理の実装イメージ

ログイン時に、Google APIを叩くための「アクセストークン」を取得し、一時的に保存する必要があります。

```typescript
// ログインボタンを押した時の処理例
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

const handleLogin = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    
    // これがGoogle APIを叩くための「鍵」です！
    // データベースには保存せず、メモリ(StateやContext)で管理します
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (accessToken) {
      console.log("Access Token Get!", accessToken);
      // ここでContextやStateにトークンを保存する処理へ
    }
    
  } catch (error) {
    console.error("Login failed", error);
  }
};
```

## 5\. 次のステップ：環境変数の準備

コードを書く前に、Google側でAPIキーなどを取得する必要があります。

1.  **Firebase Console** でプロジェクトを作成。
2.  **Authentication** で「Googleログイン」を有効にする。
3.  **プロジェクト設定** から `firebaseConfig` の内容をコピーし、`.env.local` ファイルを作成して貼り付ける。
4.  **Google Cloud Console** で `Gmail API`, `Calendar API`, `Tasks API` を検索して「有効」にする。
