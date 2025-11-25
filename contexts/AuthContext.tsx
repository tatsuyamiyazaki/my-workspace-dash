'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  accessToken: null,
  setAccessToken: () => {},
  loading: true,
});

const ACCESS_TOKEN_KEY = 'google_access_token';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // sessionStorageへの保存も行うsetAccessToken
  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    if (token) {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        // ユーザーが認証済みならsessionStorageからトークンを復元
        const storedToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
        if (storedToken) {
          setAccessTokenState(storedToken);
        }
      } else {
        // ログアウト時はトークンをクリア
        setAccessTokenState(null);
        sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, setAccessToken, loading }}>
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

