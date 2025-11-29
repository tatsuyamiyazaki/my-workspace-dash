'use client';

import { Tag } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { setAccessToken } = useAuth();

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;

      // リフレッシュトークンの取得 (型定義の回避のため any キャストを使用)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const refreshToken = (result as any)._tokenResponse?.oauthRefreshToken;

      if (accessToken) {
        console.log("Access Token:", accessToken);
        
        // リフレッシュトークンを保存
        if (refreshToken) {
          localStorage.setItem('google_refresh_token', refreshToken);
        }

        // トークンの有効期限は1時間（3600秒）
        setAccessToken(accessToken, 3600);
        // ログイン成功したらダッシュボードへ遷移
        router.push('/dashboard');
      }
    } catch (error: unknown) {
      // ユーザーがポップアップを閉じた場合は正常な動作なのでエラーログを出さない
      if (error instanceof Error && 'code' in error) {
        const errorCode = (error as { code: string }).code;
        if (errorCode === 'auth/popup-closed-by-user') {
          console.debug('User closed the login popup');
        } else if (errorCode === 'auth/popup-blocked') {
          console.warn('Login popup was blocked by the browser');
        } else {
          console.error("Login failed", error);
        }
      } else {
        console.error("Login failed", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white transition-colors duration-300">
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-blue-600 dark:text-blue-500">
            <Tag className="w-6 h-6 transform -rotate-45 fill-current" />
          </div>
          <span className="font-bold text-lg tracking-tight">ダッシュボードアプリ</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              おかえりなさい
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">
              ダッシュボードにアクセスするためにログインしてください
            </p>
          </div>

          <div className="mt-8">
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    Googleでログイン
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-xs text-gray-500 dark:text-gray-400 space-x-6">
        <a href="#" className="hover:underline hover:text-gray-900 dark:hover:text-gray-300 transition-colors">
          利用規約
        </a>
        <a href="#" className="hover:underline hover:text-gray-900 dark:hover:text-gray-300 transition-colors">
          プライバシーポリシー
        </a>
      </footer>
    </div>
  );
}
