# Gmail API使用方法

## はじめに
Gmail APIの最大の特徴（そして初心者がハマりやすいポイント）は、**「メール一覧取得API (`messages.list`) は、実はメールのIDしか返してくれない」** という点です。

件名や送信者を表示するには、取得したIDを使って、さらに「メール詳細取得API (`messages.get`)」を叩く必要があります。

これを効率よく行うための、実践的なコードセット（Utility関数と表示コンポーネント）を作成しました。

## 1\. API通信用の関数を作成 (`lib/gmailApi.ts`)

まずは、Gmail特有のデータ構造（Header配列から件名を探す処理など）を吸収する関数を作ります。

`lib/gmailApi.ts` というファイルを作成してください。

```typescript
// lib/gmailApi.ts

// メール1件分の型定義
export interface EmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  headers: {
    subject: string;
    from: string;
    date: string;
  };
}

/**
 * Gmail APIから受信トレイのメールを取得し、整形して返す関数
 * @param accessToken Googleログイン時に取得したアクセストークン
 * @param maxResults 取得件数（デフォルト10件）
 */
export const fetchInboxParams = async (accessToken: string, maxResults = 10): Promise<EmailMessage[]> => {
  
  // 1. まずメッセージの「IDリスト」を取得 (List API)
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:inbox&maxResults=${maxResults}`;
  
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!listRes.ok) throw new Error("Failed to fetch message list");
  const listData = await listRes.json();
  
  const messages = listData.messages || [];
  if (messages.length === 0) return [];

  // 2. 取得したIDを使って、並列で「詳細データ」を取りに行く (Get API)
  // Promise.allを使って一気に叩くのがコツです
  const detailPromises = messages.map(async (msg: { id: string }) => {
    const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
    const res = await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.json();
  });

  const rawDetails = await Promise.all(detailPromises);

  // 3. 使いやすい形に整形する
  // Gmailのヘッダーは配列なので、findで特定のキーを探す必要があります
  const formattedEmails = rawDetails.map((email: any) => {
    const headers = email.payload.headers;
    
    const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || "(No Subject)";

    return {
      id: email.id,
      threadId: email.threadId,
      snippet: email.snippet, // 本文の要約
      headers: {
        subject: getHeader("Subject"),
        from: getHeader("From"),
        date: getHeader("Date"),
      },
    };
  });

  return formattedEmails;
};
```

## 2\. 表示用コンポーネント (`app/dashboard/_components/MailList.tsx`)

次に、この関数を使って画面に表示するReactコンポーネントです。
`useEffect` でデータを読み込みます。

```tsx
// app/dashboard/_components/MailList.tsx
"use client";

import { useState, useEffect } from "react";
import { fetchInboxParams, EmailMessage } from "@/lib/gmailApi";

// 親コンポーネントからアクセストークンを受け取る
export default function MailList({ accessToken }: { accessToken: string }) {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;

    const loadEmails = async () => {
      try {
        setLoading(true);
        // さきほど作った関数を呼ぶだけ！
        const data = await fetchInboxParams(accessToken);
        setEmails(data);
      } catch (err) {
        console.error(err);
        setError("メールの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    loadEmails();
  }, [accessToken]);

  if (loading) return <div className="p-4">読み込み中...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="w-full max-w-2xl bg-white shadow rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b">
        <h2 className="text-lg font-semibold text-gray-700">受信トレイ</h2>
      </div>
      <ul className="divide-y divide-gray-200">
        {emails.map((email) => (
          <li key={email.id} className="p-4 hover:bg-gray-50 transition">
            <div className="flex justify-between items-start mb-1">
              <span className="font-bold text-gray-900 truncate w-2/3">
                {email.headers.subject}
              </span>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {/* 日付の整形は本来date-fnsなどを使うと綺麗です */}
                {new Date(email.headers.date).toLocaleDateString()}
              </span>
            </div>
            <div className="text-sm text-gray-600 mb-1">
              {email.headers.from}
            </div>
            <p className="text-xs text-gray-400 truncate">
              {email.snippet}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 解説とポイント

1.  **N+1問題の解決 (`Promise.all`)**
      * コード内の「2.」の部分です。メール一覧を取得した後、`map` でAPIリクエストの配列を作り、`Promise.all` で一気に実行しています。これをやらないと、1件ずつ順番に取得することになり、表示が非常に遅くなります。
2.  **Headerのパース**
      * Gmail APIのレスポンスは、件名などが `payload.headers` という配列の中にバラバラに入っています。`headers.find(h => h.name === "Subject")` のような処理を書かないと件名が取り出せないのが特徴です。
3.  **アクセストークン**
      * このコードは `accessToken` が正しいことを前提に動きます。Firebase Authでログインした後、`credential.accessToken` を取得し、このコンポーネントにPropsとして渡してあげてください。
