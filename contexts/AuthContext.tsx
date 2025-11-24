'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (!user) {
        setAccessToken(null);
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
});

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [refreshInterval, setRefreshIntervalState] = useState(1);
  const [notificationMinutes, setNotificationMinutesState] = useState<number[]>([5, 15]);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(false);
  const [fixedLinks, setFixedLinksState] = useState<FixedLink[]>(DEFAULT_FIXED_LINKS);

  useEffect(() => {
    const savedInterval = localStorage.getItem('dashboardRefreshInterval');
    if (savedInterval) {
      setRefreshIntervalState(parseInt(savedInterval, 10));
    }

    const savedNotifications = localStorage.getItem('notificationMinutes');
    if (savedNotifications) {
      setNotificationMinutesState(JSON.parse(savedNotifications));
    }

    const savedEnabled = localStorage.getItem('notificationsEnabled');
    if (savedEnabled !== null) {
      setNotificationsEnabledState(savedEnabled === 'true');
    }

    const savedFixedLinks = localStorage.getItem('fixedLinks');
    if (savedFixedLinks) {
      setFixedLinksState(JSON.parse(savedFixedLinks));
    }
  }, []);

  const setRefreshInterval = (interval: number) => {
    setRefreshIntervalState(interval);
    localStorage.setItem('dashboardRefreshInterval', interval.toString());
  };

  const setNotificationMinutes = (minutes: number[]) => {
    setNotificationMinutesState(minutes);
    localStorage.setItem('notificationMinutes', JSON.stringify(minutes));
  };

  const setNotificationsEnabled = (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    localStorage.setItem('notificationsEnabled', enabled.toString());
  };

  const setFixedLinks = (links: FixedLink[]) => {
    setFixedLinksState(links);
    localStorage.setItem('fixedLinks', JSON.stringify(links));
  };

  return (
    <SettingsContext.Provider value={{ 
      refreshInterval, 
      setRefreshInterval,
      notificationMinutes,
      setNotificationMinutes,
      notificationsEnabled,
      setNotificationsEnabled,
      fixedLinks,
      setFixedLinks,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
