// メール1件分の型定義
export interface EmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  body?: string; // 本文を追加
  labelIds?: string[]; // ラベルID (UNREAD, INBOX等)
  headers: {
    subject: string;
    from: string;
    to: string;
    date: string;
  };
}

// Base64Urlデコード関数
const decodeBase64 = (data: string) => {
  if (!data) return '';
  try {
    // Base64Url -> Base64
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    // 日本語文字化け対策を含むデコード
    return decodeURIComponent(escape(window.atob(base64)));
  } catch (e) {
    console.error('Failed to decode email body', e);
    return '';
  }
};

// ペイロードから本文を抽出する関数
const extractBody = (payload: any): string => {
  let encodedBody = '';
  
  if (payload.body && payload.body.data) {
    encodedBody = payload.body.data;
  } else if (payload.parts) {
    // text/html を優先して探す
    const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
    if (htmlPart && htmlPart.body && htmlPart.body.data) {
      encodedBody = htmlPart.body.data;
    } else {
      // なければ text/plain を探す
      const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
      if (textPart && textPart.body && textPart.body.data) {
        encodedBody = textPart.body.data;
      } else {
        // さらにネストしている場合（multipart/alternativeなど）の再帰探索は今回は簡易的に省略し、
        // 最初のパーツを見るなどのフォールバックを入れることも可能ですが、
        // 一般的なメール構造なら上記でカバーできます。
      }
    }
  }
  
  return decodeBase64(encodedBody);
};

// Helper to format a single message
const formatEmailMessage = (email: any): EmailMessage => {
  const headers = email.payload.headers;
  const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || "";
  
  return {
    id: email.id,
    threadId: email.threadId,
    snippet: email.snippet,
    body: extractBody(email.payload),
    labelIds: email.labelIds || [],
    headers: {
      subject: getHeader("Subject") || "(No Subject)",
      from: getHeader("From") || "(Unknown Sender)",
      to: getHeader("To") || "(Unknown Recipient)",
      date: getHeader("Date"),
    },
  };
};

/**
 * Gmail APIから受信トレイのメールを取得し、整形して返す関数
 * @param accessToken Googleログイン時に取得したアクセストークン
 * @param maxResults 取得件数（デフォルト20件）
 */
export const fetchInboxEmails = async (accessToken: string, maxResults = 20): Promise<{ count: number, emails: EmailMessage[], unreadCount: number }> => {
  
  // 1. まずメッセージの「IDリスト」を取得 (List API)
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=${maxResults}`;
  
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!listRes.ok) {
    const errorBody = await listRes.text();
    console.error(`Gmail API Error: ${listRes.status} ${listRes.statusText}`, errorBody);
    throw new Error(`Failed to fetch inbox messages: ${listRes.status} ${listRes.statusText}`);
  }
  const listData = await listRes.json();
  
  const totalCount = listData.resultSizeEstimate || 0;
  const messages = listData.messages || [];
  if (messages.length === 0) return { count: totalCount, emails: [], unreadCount: 0 };

  // 2. 取得したIDを使って、並列で「詳細データ」を取りに行く (Get API)
  const detailPromises = messages.map(async (msg: { id: string }) => {
    const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
    const res = await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.json();
  });

  const rawDetails = await Promise.all(detailPromises);

  // 3. 使いやすい形に整形する
  const formattedEmails = rawDetails.map(formatEmailMessage);
  
  // 4. 未読数をカウント
  const unreadCount = rawDetails.filter((email: any) => 
    email.labelIds && email.labelIds.includes('UNREAD')
  ).length;

  return { count: totalCount, emails: formattedEmails, unreadCount };
};

/**
 * 未読メールを取得する関数
 * @param accessToken アクセストークン
 * @param maxResults 最大取得件数
 */
export const fetchUnreadEmails = async (accessToken: string, maxResults = 10): Promise<{ count: number, emails: EmailMessage[] }> => {
  // 1. 未読メッセージのリストと総数を取得
  // includeSpamTrash=false はデフォルトですが、明示的に除外
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=${maxResults}`;
  
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!listRes.ok) {
    const errorBody = await listRes.text();
    console.error(`Gmail API Error: ${listRes.status} ${listRes.statusText}`, errorBody);
    throw new Error(`Failed to fetch unread messages: ${listRes.status} ${listRes.statusText}`);
  }
  const listData = await listRes.json();
  
  // resultSizeEstimate は概算ですが、未読数として使えます
  // 正確な数は messages.length ですが、ページネーションがあるため、
  // 全体の未読数を知るには profile API を叩くのが確実ですが、ここでは簡易的に resultSizeEstimate を使うか、
  // 別途 getProfile を呼ぶのが良いでしょう。
  // 今回は listData.resultSizeEstimate を使います。
  const unreadCount = listData.resultSizeEstimate || 0;
  
  const messages = listData.messages || [];
  if (messages.length === 0) return { count: unreadCount, emails: [] };

  // 2. 詳細データを取得
  const detailPromises = messages.map(async (msg: { id: string }) => {
    const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
    const res = await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.json();
  });

  const rawDetails = await Promise.all(detailPromises);

  // 3. 整形
  const formattedEmails = rawDetails.map(formatEmailMessage);

  return { count: unreadCount, emails: formattedEmails };
};

/**
// スレッド内の全メッセージを取得する関数
 * @param accessToken アクセストークン
 * @param threadId スレッドID
 */
export const fetchThread = async (accessToken: string, threadId: string): Promise<EmailMessage[]> => {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!res.ok) throw new Error(`Failed to fetch thread: ${res.status}`);
  
  const data = await res.json();
  // messages are usually sorted by date in the thread response
  return (data.messages || []).map(formatEmailMessage);
};

/**
 * メールを既読にする関数
 * @param accessToken アクセストークン
 * @param messageId メッセージID
 */
export const markAsRead = async (accessToken: string, messageId: string): Promise<void> => {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`;
  const body = {
    removeLabelIds: ['UNREAD'],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to mark as read: ${res.status} ${errorBody}`);
  }
};

/**
 * メールをアーカイブする関数
 * @param accessToken アクセストークン
 * @param messageId メッセージID
 */
export const archiveEmail = async (accessToken: string, messageId: string): Promise<void> => {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`;
  const body = {
    removeLabelIds: ['INBOX'],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to archive email: ${res.status} ${errorBody}`);
  }
};
