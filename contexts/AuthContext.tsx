'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  setAccessToken: (token: string | null, expiresIn?: number) => void;
  loading: boolean;
  refreshAccessToken: () => Promise<string | null>;
  getValidAccessToken: () => Promise<string | null>;
  isTokenExpired: () => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  accessToken: null,
  setAccessToken: () => {},
  loading: true,
  refreshAccessToken: async () => null,
  getValidAccessToken: async () => null,
  isTokenExpired: () => true,
});

const ACCESS_TOKEN_KEY = 'google_access_token';
const TOKEN_EXPIRY_KEY = 'google_token_expiry';
// トークンの有効期限は1時間だが、余裕を持って50分で更新する
const TOKEN_REFRESH_BUFFER_MS = 10 * 60 * 1000; // 10分前に更新

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  // トークンが期限切れかどうかをチェック
  const isTokenExpired = useCallback(() => {
    if (!tokenExpiry) return true;
    return Date.now() >= tokenExpiry - TOKEN_REFRESH_BUFFER_MS;
  }, [tokenExpiry]);

  // sessionStorageへの保存も行うsetAccessToken
  const setAccessToken = useCallback((token: string | null, expiresIn?: number) => {
    setAccessTokenState(token);
    if (token) {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
      // expiresInが指定されていれば有効期限を設定、なければデフォルト1時間
      const expiry = Date.now() + (expiresIn || 3600) * 1000;
      setTokenExpiry(expiry);
      sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
    } else {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
      setTokenExpiry(null);
    }
  }, []);

  // トークンを更新する関数
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;

    // 既に更新中の場合は待機
    if (isRefreshingRef.current) {
      // 更新が完了するまで少し待つ
      await new Promise(resolve => setTimeout(resolve, 1000));
      return sessionStorage.getItem(ACCESS_TOKEN_KEY);
    }

    isRefreshingRef.current = true;

    try {
      // Googleで再認証してトークンを更新
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const newAccessToken = credential?.accessToken;

      if (newAccessToken) {
        setAccessToken(newAccessToken, 3600);
        console.log('Access token refreshed successfully');
        return newAccessToken;
      }
      return null;
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      return null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [user, setAccessToken]);

  // 有効なトークンを取得する（期限切れなら更新）
  const getValidAccessToken = useCallback(async (): Promise<string | null> => {
    if (!accessToken) return null;

    if (isTokenExpired()) {
      console.log('Token expired or expiring soon, refreshing...');
      return await refreshAccessToken();
    }

    return accessToken;
  }, [accessToken, isTokenExpired, refreshAccessToken]);

  // トークン自動更新のタイマーを設定
  useEffect(() => {
    if (!tokenExpiry || !user) return;

    // 既存のタイマーをクリア
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // 更新タイミングを計算（期限の10分前）
    const refreshTime = tokenExpiry - TOKEN_REFRESH_BUFFER_MS - Date.now();

    if (refreshTime > 0) {
      console.log(`Token will be refreshed in ${Math.round(refreshTime / 1000 / 60)} minutes`);
      refreshTimerRef.current = setTimeout(async () => {
        console.log('Auto-refreshing token...');
        await refreshAccessToken();
      }, refreshTime);
    } else if (refreshTime > -TOKEN_REFRESH_BUFFER_MS) {
      // 既に更新タイミングを過ぎているが、まだ有効期限内なら即座に更新
      refreshAccessToken();
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [tokenExpiry, user, refreshAccessToken]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        // ユーザーが認証済みならsessionStorageからトークンを復元
        const storedToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
        const storedExpiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
        if (storedToken) {
          setAccessTokenState(storedToken);
          if (storedExpiry) {
            const expiry = parseInt(storedExpiry, 10);
            setTokenExpiry(expiry);
            // 復元したトークンが期限切れに近い場合は更新
            if (Date.now() >= expiry - TOKEN_REFRESH_BUFFER_MS) {
              console.log('Restored token is expired or expiring soon');
            }
          }
        }
      } else {
        // ログアウト時はトークンをクリア
        setAccessTokenState(null);
        setTokenExpiry(null);
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      setAccessToken,
      loading,
      refreshAccessToken,
      getValidAccessToken,
      isTokenExpired,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export interface FixedLink {
  id: string;
  name: string;
  url: string;
  icon: string;
}

export interface CustomLink {
  id: string;
  name: string;
  url: string;
  icon: string;
  folderId?: string;
}

export interface LinkFolder {
  id: string;
  name: string;
  icon: string;
  isExpanded: boolean;
}

const DEFAULT_FIXED_LINKS: FixedLink[] = [
  { id: '1', name: 'ワークドライブ', url: '#', icon: 'Folder' },
  { id: '2', name: 'チームチャット', url: '#', icon: 'MessageSquare' },
  { id: '3', name: 'ニュースフィード', url: '#', icon: 'FileText' },
];

// Settings Context
interface SettingsContextType {
  refreshInterval: number; // in minutes
  setRefreshInterval: (interval: number) => void;
  notificationMinutes: number[]; // minutes before event to notify
  setNotificationMinutes: (minutes: number[]) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  fixedLinks: FixedLink[];
  setFixedLinks: (links: FixedLink[]) => void;
  customLinks: CustomLink[];
  setCustomLinks: (links: CustomLink[]) => void;
  folders: LinkFolder[];
  setFolders: (folders: LinkFolder[]) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  refreshInterval: 1,
  setRefreshInterval: () => {},
  notificationMinutes: [5, 15],
  setNotificationMinutes: () => {},
  notificationsEnabled: false,
  setNotificationsEnabled: () => {},
  fixedLinks: DEFAULT_FIXED_LINKS,
  setFixedLinks: () => {},
  customLinks: [],
  setCustomLinks: () => {},
  folders: [],
  setFolders: () => {},
});

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  // ローカルストレージからFirestoreへの移行関数
  const migrateLocalToFirestore = useCallback(async (uid: string) => {
    const localInterval = localStorage.getItem('dashboardRefreshInterval');
    const localNotifTime = localStorage.getItem('notificationMinutes');
    const localNotifEnabled = localStorage.getItem('notificationsEnabled');
    const localFixed = localStorage.getItem('fixedLinks');
    const localCustom = localStorage.getItem('customLinks');
    const localFolders = localStorage.getItem('linkFolders');

    const initialData = {
      settings: {
        refreshInterval: localInterval ? parseInt(localInterval) : 1,
        notificationMinutes: localNotifTime ? JSON.parse(localNotifTime) : [5, 15],
        notificationsEnabled: localNotifEnabled === 'true',
        fixedLinks: localFixed ? JSON.parse(localFixed) : DEFAULT_FIXED_LINKS,
      },
      customLinks: localCustom ? JSON.parse(localCustom) : [],
      folders: localFolders ? JSON.parse(localFolders) : [],
    };

    // Firestoreに保存
    await setDoc(doc(db, "users", uid), initialData, { merge: true });
    
    // オプション: 移行後にローカルストレージをクリアするならここで実行
    // localStorage.clear();
  }, []);

  // Filrestoreへの保存ヘルパー関数
  const saveToFirestore = useCallback(async (key: string, value: unknown) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);

    // setting配下のデータか、ルート直下のデータ (customLinks or folders) かで分岐
    if (['refreshInterval', 'notificationMinutes', 'notificationsEnabled', 'fixedLinks'].includes(key)) {
      // Type guard for settings properties
      if (key === 'refreshInterval' && typeof value !== 'number') return;
      if (key === 'notificationMinutes' && (!Array.isArray(value) || !value.every(item => typeof item === 'number'))) return;
      if (key === 'notificationsEnabled' && typeof value !== 'boolean') return;
      if (key === 'fixedLinks' && (!Array.isArray(value) || !value.every((item: FixedLink) => typeof item === 'object' && 'id' in item && 'name' in item && 'url' in item && 'icon' in item))) return;

      await setDoc(userDocRef, { settings: { [key]: value } }, { merge: true });
    } else {
      // Type guard for root properties
      if (key === 'customLinks' && (!Array.isArray(value) || !value.every((item: CustomLink) => typeof item === 'object' && 'id' in item && 'name' in item && 'url' in item && 'icon' in item))) return;
      if (key === 'folders' && (!Array.isArray(value) || !value.every((item: LinkFolder) => typeof item === 'object' && 'id' in item && 'name' in item && 'icon' in item))) return;

      await setDoc(userDocRef, { [key]: value }, { merge: true });
    }
  }, [user]);

  // Setter関数のラッパ (State更新 + Firestore保存)
  const [refreshInterval, setRefreshIntervalState] = useState(1);
  const [notificationMinutes, setNotificationMinutesState] = useState<number[]>([5, 15]);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [fixedLinks, setFixedLinksState] = useState<FixedLink[]>(DEFAULT_FIXED_LINKS);
  const [customLinks, setCustomLinksState] = useState<CustomLink[]>([]);
  const [folders, setFoldersState] = useState<LinkFolder[]>([]);

  // Firestoreとの同期処理
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);

    // リアルタイムリステナーを設定
    const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        // FirestoreにデータがあればStateに反映
        const data = docSnap.data();
        if (data.settings) {
          setRefreshIntervalState(data.settings.refreshInterval ?? 1);
          setNotificationMinutesState(data.settings.notificationMinutes ?? [5, 15]);
          setNotificationsEnabledState(data.settings.notificationsEnabled ?? false);
          setFixedLinksState(data.settings.fixedLinks ?? DEFAULT_FIXED_LINKS);
        }
        setCustomLinksState(data.customLinks ?? []);
        setFoldersState(data.folders ?? []);
      } else {
        // Firestoreにデータがない場合（初回ログイン時など）、ローカルストレージから移行を試みる
        await migrateLocalToFirestore(user.uid);
      }
    });

    return () => unsubscribe();
  }, [user, migrateLocalToFirestore]);

  // Setter functions wrappers
  const setRefreshInterval = (val: number) => {
    setRefreshIntervalState(val);
    saveToFirestore('refreshInterval', val);
  };
  const setNotificationMinutes = (val: number[]) => {
    setNotificationMinutesState(val);
    saveToFirestore('notificationMinutes', val);
  };
  const setNotificationsEnabled = (val: boolean) => {
    setNotificationsEnabledState(val);
    saveToFirestore('notificationsEnabled', val);
  };
  const setFixedLinks = (val: FixedLink[]) => {
    setFixedLinksState(val);
    saveToFirestore('fixedLinks', val);
  };
  const setCustomLinks = (val: CustomLink[]) => {
    setCustomLinksState(val);
    saveToFirestore('customLinks', val);
  };
  const setFolders = (val: LinkFolder[]) => {
    setFoldersState(val);
    saveToFirestore('folders', val);
  };

  return (
    <SettingsContext.Provider value={{ 
      refreshInterval, setRefreshInterval,
      notificationMinutes, setNotificationMinutes,
      notificationsEnabled, setNotificationsEnabled,
      fixedLinks, setFixedLinks,
      customLinks, setCustomLinks,
      folders, setFolders,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);

