// Gmail APIのレスポンスに対応する型定義
interface GmailMessageHeader {
  name: string;
  value: string;
}

interface GmailMessagePartBody {
  attachmentId?: string;
  size: number;
  data?: string;
}

interface GmailMessagePart {
  partId: string;
  mimeType: string;
  filename: string;
  headers?: GmailMessageHeader[];
  body: GmailMessagePartBody;
  parts?: GmailMessagePart[]; // ネストされたパート
}

interface GmailMessagePayload {
  partId: string;
  mimeType: string;
  filename: string;
  headers: GmailMessageHeader[];
  body: GmailMessagePartBody;
  parts?: GmailMessagePart[];
}

interface GmailRawMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: GmailMessagePayload;
  sizeEstimate: number;
  historyId: string;
  internalDate: string;
}

// 添付ファイル情報の型定義
export interface EmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

// インライン画像情報の型定義
export interface InlineImage {
  contentId: string; // Content-ID (cidで参照される)
  mimeType: string;
  data: string; // Base64エンコードされたデータ
}

// メール1件分の型定義
export interface EmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  body?: string; // 本文を追加
  labelIds?: string[]; // ラベルID (UNREAD, INBOX等)
  attachments?: EmailAttachment[]; // 添付ファイル一覧
  inlineImages?: InlineImage[]; // インライン画像一覧
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

// テキストメール（text/plain）をHTMLに変換する関数
// あらゆる改行コード(\r\n, \r, \n)に対応
const convertTextToHtml = (text: string): string => {
  // HTMLエスケープ（XSS対策）
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // URLをリンクに変換
  // 注意: エスケープ後の文字列に対して処理するため、&amp;などを考慮
  const urlPattern = /(https?:\/\/[^\s<>"']+)/g;
  const withLinks = escaped.replace(urlPattern, '<a href="$1">$1</a>');

  // あらゆる改行コードをHTMLの<br>タグに変換
  // 重要：\r\nを最初に処理して、\rと\nの重複処理を防ぐ
  return withLinks
    .replace(/\r\n/g, '<br>')
    .replace(/\r/g, '<br>')
    .replace(/\n/g, '<br>');
};

// ペイロードから本文を抽出する関数
// テキストメールの場合は改行コード対応を行う
const extractBody = (payload: GmailMessagePayload): string => {
  let htmlBody: string | null = null;
  let textBody: string | null = null;

  // 再帰的にパートを探索して本文候補を探す
  const findBodyParts = (parts: GmailMessagePart[] | undefined) => {
    if (!parts) return;

    for (const part of parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        // text/htmlが見つかったら優先的に採用
        // 複数ある場合は最初のものを採用（必要に応じてロジック調整）
        if (!htmlBody) htmlBody = part.body.data;
      } else if (part.mimeType === 'text/plain' && part.body?.data) {
        // text/plainはhtmlがない場合のフォールバック
        if (!textBody) textBody = part.body.data;
      }

      // ネストされたパートを再帰的に探索
      if (part.parts) {
        findBodyParts(part.parts);
      }
    }
  };

  // ルート自体が本文の場合
  if (payload.body?.data) {
    if (payload.mimeType === 'text/html') {
      htmlBody = payload.body.data;
    } else if (payload.mimeType === 'text/plain') {
      textBody = payload.body.data;
    }
  }

  // ネストされたパートがある場合は探索
  if (payload.parts) {
    findBodyParts(payload.parts);
  }

  // 結果の返却（HTML優先）
  if (htmlBody) {
    return decodeBase64(htmlBody);
  }

  if (textBody) {
    const decodedText = decodeBase64(textBody);
    return convertTextToHtml(decodedText);
  }

  return '';
};

// ペイロードから添付ファイル情報を抽出する関数
const extractAttachments = (payload: GmailMessagePayload, messageId: string): EmailAttachment[] => {
  const attachments: EmailAttachment[] = [];

  const findAttachments = (parts: GmailMessagePart[] | undefined) => {
    if (!parts) return;

    for (const part of parts) {
      // 添付ファイルはattachmentIdを持ち、ファイル名がある
      if (part.body?.attachmentId && part.filename) {
        attachments.push({
          attachmentId: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size || 0,
        });
      }
      // ネストされたパーツを再帰的に探索
      if (part.parts) {
        findAttachments(part.parts);
      }
    }
  };

  findAttachments(payload.parts);

  return attachments;
};

// インライン画像のパーツ情報（後でデータを取得するため）
interface InlineImagePart {
  contentId: string;
  mimeType: string;
  data?: string;  // 直接データがある場合
  attachmentId?: string;  // 別途取得が必要な場合
}

// ペイロードからインライン画像を抽出する関数（同期版 - パーツ情報のみ）
const extractInlineImageParts = (payload: GmailMessagePayload): InlineImagePart[] => {
  const inlineImageParts: InlineImagePart[] = [];

  const findInlineImages = (parts: GmailMessagePart[] | undefined) => {
    if (!parts) return;

    for (const part of parts) {
      // 画像タイプで、Content-IDを持つ場合はインライン画像
      if (part.mimeType?.startsWith('image/') && part.headers) {
        const contentIdHeader = part.headers.find(h => h.name.toLowerCase() === 'content-id');
        if (contentIdHeader) {
          // Content-IDから<>を除去
          let contentId = contentIdHeader.value;
          if (contentId.startsWith('<') && contentId.endsWith('>')) {
            contentId = contentId.slice(1, -1);
          }

          if (part.body?.data) {
            // 直接データがある場合
            const base64Data = part.body.data.replace(/-/g, '+').replace(/_/g, '/');
            inlineImageParts.push({
              contentId,
              mimeType: part.mimeType,
              data: base64Data,
            });
          } else if (part.body?.attachmentId) {
            // attachmentIdがある場合は後で取得
            inlineImageParts.push({
              contentId,
              mimeType: part.mimeType,
              attachmentId: part.body.attachmentId,
            });
          }
        }
      }
      // ネストされたパーツを再帰的に探索
      if (part.parts) {
        findInlineImages(part.parts);
      }
    }
  };

  findInlineImages(payload.parts);

  return inlineImageParts;
};

// インライン画像のデータを取得する関数（非同期）
const fetchInlineImageData = async (
  accessToken: string,
  messageId: string,
  imageParts: InlineImagePart[]
): Promise<InlineImage[]> => {
  const inlineImages: InlineImage[] = [];

  for (const part of imageParts) {
    if (part.data) {
      // 既にデータがある場合
      inlineImages.push({
        contentId: part.contentId,
        mimeType: part.mimeType,
        data: part.data,
      });
    } else if (part.attachmentId) {
      // attachmentIdからデータを取得
      try {
        const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${part.attachmentId}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          const base64Data = data.data.replace(/-/g, '+').replace(/_/g, '/');
          inlineImages.push({
            contentId: part.contentId,
            mimeType: part.mimeType,
            data: base64Data,
          });
        }
      } catch (error) {
        console.error('Failed to fetch inline image:', part.contentId, error);
      }
    }
  }

  return inlineImages;
};

// 本文中のcid:参照をdata URIに置換する関数
const replaceCidWithDataUri = (body: string, inlineImages: InlineImage[]): string => {
  if (!body || inlineImages.length === 0) return body;

  let result = body;

  for (const image of inlineImages) {
    const dataUri = `data:${image.mimeType};base64,${image.data}`;

    // 1. 通常のパターン: src="cid:contentId"
    // src="cid:xxx" や src='cid:xxx' の両方に対応
    const cidPattern = new RegExp(`(src=["'])cid:${escapeRegExp(image.contentId)}(["'])`, 'gi');
    result = result.replace(cidPattern, `$1${dataUri}$2`);

    // 2. URLエンコードされたパターンを考慮
    // メール本文内のcidリンクがURLエンコードされている場合があるため (例: foo@bar -> foo%40bar)
    const encodedId = encodeURIComponent(image.contentId);
    if (encodedId !== image.contentId) {
      const cidPatternEncoded = new RegExp(`(src=["'])cid:${escapeRegExp(encodedId)}(["'])`, 'gi');
      result = result.replace(cidPatternEncoded, `$1${dataUri}$2`);
    }
  }

  return result;
};

// 正規表現の特殊文字をエスケープする関数
const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// 初期フォーマット結果（インライン画像はまだ未処理）
interface FormattedEmailWithParts {
  email: EmailMessage;
  inlineImageParts: InlineImagePart[];
}

// Helper to format a single message (同期版 - インライン画像パーツ情報も返す)
const formatEmailMessage = (email: GmailRawMessage): FormattedEmailWithParts | null => {
  // payloadがない場合はnullを返す（不完全なレスポンス）
  if (!email || !email.payload || !email.payload.headers) {
    console.warn('Incomplete email data:', email?.id);
    return null;
  }

  const headers = email.payload.headers;
  const getHeader = (name: string) => headers.find((h: GmailMessageHeader) => h.name === name)?.value || "";

  // インライン画像のパーツ情報を抽出（データ取得は後で行う）
  const inlineImageParts = extractInlineImageParts(email.payload);

  // 本文を抽出
  const body = extractBody(email.payload);

  return {
    email: {
      id: email.id,
      threadId: email.threadId,
      snippet: email.snippet,
      body,
      labelIds: email.labelIds || [],
      attachments: extractAttachments(email.payload, email.id),
      inlineImages: [],  // 後で設定される
      headers: {
        subject: getHeader("Subject") || "(No Subject)",
        from: getHeader("From") || "(Unknown Sender)",
        to: getHeader("To") || "(Unknown Recipient)",
        date: getHeader("Date"),
      },
    },
    inlineImageParts,
  };
};

// インライン画像を処理してメールを完成させる関数
const processInlineImages = async (
  accessToken: string,
  formatted: FormattedEmailWithParts
): Promise<EmailMessage> => {
  if (formatted.inlineImageParts.length === 0) {
    return formatted.email;
  }

  // インライン画像のデータを取得
  const inlineImages = await fetchInlineImageData(
    accessToken,
    formatted.email.id,
    formatted.inlineImageParts
  );

  // CID参照をdata URIに置換
  let body = formatted.email.body || '';
  if (inlineImages.length > 0) {
    body = replaceCidWithDataUri(body, inlineImages);
  }

  return {
    ...formatted.email,
    body,
    inlineImages,
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

  const rawDetails: GmailRawMessage[] = await Promise.all(detailPromises);

  // 3. 使いやすい形に整形する（不完全なデータはフィルタリング）
  const formattedWithParts = rawDetails
    .map(formatEmailMessage)
    .filter((result): result is FormattedEmailWithParts => result !== null);

  // 4. インライン画像を処理
  const formattedEmails = await Promise.all(
    formattedWithParts.map(formatted => processInlineImages(accessToken, formatted))
  );

  // 5. 未読数をカウント
  const unreadCount = rawDetails.filter((email: GmailRawMessage) =>
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

  const rawDetails: GmailRawMessage[] = await Promise.all(detailPromises);

  // 3. 整形（不完全なデータはフィルタリング）
  const formattedWithParts = rawDetails
    .map(formatEmailMessage)
    .filter((result): result is FormattedEmailWithParts => result !== null);

  // 4. インライン画像を処理
  const formattedEmails = await Promise.all(
    formattedWithParts.map(formatted => processInlineImages(accessToken, formatted))
  );

  return { count: unreadCount, emails: formattedEmails };
};

/**
 * スレッド内の全メッセージを取得する関数
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

  // 整形
  const formattedWithParts = (data.messages || [])
    .map(formatEmailMessage)
    .filter((result: FormattedEmailWithParts | null): result is FormattedEmailWithParts => result !== null);

  // インライン画像を処理
  const formattedEmails = await Promise.all(
    formattedWithParts.map((formatted: FormattedEmailWithParts) => processInlineImages(accessToken, formatted))
  );

  return formattedEmails;
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

/**
 * メールをゴミ箱に移動する関数
 * @param accessToken アクセストークン
 * @param messageId メッセージID
 */
export const trashEmail = async (accessToken: string, messageId: string): Promise<void> => {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to trash email: ${res.status} ${errorBody}`);
  }
};

/**
 * スター付きメールを取得する関数
 * @param accessToken アクセストークン
 * @param maxResults 最大取得件数
 */
export const fetchStarredEmails = async (accessToken: string, maxResults = 50): Promise<{ count: number, emails: EmailMessage[] }> => {
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:starred&maxResults=${maxResults}`;

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    const errorBody = await listRes.text();
    console.error(`Gmail API Error: ${listRes.status} ${listRes.statusText}`, errorBody);
    throw new Error(`Failed to fetch starred messages: ${listRes.status} ${listRes.statusText}`);
  }
  const listData = await listRes.json();

  const totalCount = listData.resultSizeEstimate || 0;
  const messages = listData.messages || [];
  if (messages.length === 0) return { count: totalCount, emails: [] };

  const detailPromises = messages.map(async (msg: { id: string }) => {
    const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
    const res = await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.json();
  });

  const rawDetails: GmailRawMessage[] = await Promise.all(detailPromises);

  // 整形
  const formattedWithParts = rawDetails
    .map(formatEmailMessage)
    .filter((result): result is FormattedEmailWithParts => result !== null);

  // インライン画像を処理
  const formattedEmails = await Promise.all(
    formattedWithParts.map(formatted => processInlineImages(accessToken, formatted))
  );

  return { count: totalCount, emails: formattedEmails };
};

/**
 * すべてのメールを取得する関数（受信トレイ以外も含む）
 * @param accessToken アクセストークン
 * @param maxResults 最大取得件数
 */
export const fetchAllEmails = async (accessToken: string, maxResults = 50): Promise<{ count: number, emails: EmailMessage[] }> => {
  // 空のクエリですべてのメールを取得（スパム・ゴミ箱を除く）
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listRes.ok) {
    const errorBody = await listRes.text();
    console.error(`Gmail API Error: ${listRes.status} ${listRes.statusText}`, errorBody);
    throw new Error(`Failed to fetch all messages: ${listRes.status} ${listRes.statusText}`);
  }
  const listData = await listRes.json();

  const totalCount = listData.resultSizeEstimate || 0;
  const messages = listData.messages || [];
  if (messages.length === 0) return { count: totalCount, emails: [] };

  const detailPromises = messages.map(async (msg: { id: string }) => {
    const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
    const res = await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.json();
  });

  const rawDetails: GmailRawMessage[] = await Promise.all(detailPromises);

  // 整形
  const formattedWithParts = rawDetails
    .map(formatEmailMessage)
    .filter((result): result is FormattedEmailWithParts => result !== null);

  // インライン画像を処理
  const formattedEmails = await Promise.all(
    formattedWithParts.map(formatted => processInlineImages(accessToken, formatted))
  );

  return { count: totalCount, emails: formattedEmails };
};

/**
 * 添付ファイルをダウンロードして開く関数
 * @param accessToken アクセストークン
 * @param messageId メッセージID
 * @param attachmentId 添付ファイルID
 * @param filename ファイル名
 * @param mimeType MIMEタイプ
 */
export const downloadAndOpenAttachment = async (
  accessToken: string,
  messageId: string,
  attachmentId: string,
  filename: string,
  mimeType: string
): Promise<void> => {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to fetch attachment: ${res.status} ${errorBody}`);
  }

  const data = await res.json();

  // Base64Url -> Base64 変換
  const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/');

  // Base64をバイナリに変換
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  // Blobを作成してダウンロードまたは開く
  const blob = new Blob([byteArray], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);

  // 新しいタブで開く（プレビュー可能なファイルは表示、それ以外はダウンロード）
  window.open(blobUrl, '_blank');

  // URLを後でクリーンアップ
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};
