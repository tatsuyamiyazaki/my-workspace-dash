import { EmailMessage, fetchThread, markAsRead, archiveEmail } from '@/lib/gmailApi';
import { format, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useState } from 'react';
import { X, Reply, ExternalLink, User, Clock, Archive, Mail, MailOpen } from 'lucide-react';

interface MailListProps {
  emails: EmailMessage[];
  loading?: boolean;
  accessToken?: string | null;
  onRefresh?: () => void;
}

export default function MailList({ emails, loading = false, accessToken, onRefresh }: MailListProps) {
  const [selectedThread, setSelectedThread] = useState<EmailMessage[] | null>(null);
  const [currentThreadIndex, setCurrentThreadIndex] = useState(0);
  const [loadingThread, setLoadingThread] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const handleEmailClick = async (email: EmailMessage) => {
    if (!accessToken) return;
    
    try {
      setLoadingThread(true);
      // スレッド全体を取得
      const threadMessages = await fetchThread(accessToken, email.threadId);
      setSelectedThread(threadMessages);
      // 最新のメッセージ（通常は最後）を表示
      setCurrentThreadIndex(threadMessages.length - 1);
      // 既読化（Gmail API）
      await markAsRead(accessToken, email.id);
    } catch (error) {
      console.error("Failed to fetch thread", error);
      // フォールバック: 単一メッセージのみ表示
      setSelectedThread([email]);
      setCurrentThreadIndex(0);
    } finally {
      setLoadingThread(false);
    }
  };

  const currentMessage = selectedThread ? selectedThread[currentThreadIndex] : null;

  const handleArchive = async (email: EmailMessage) => {
    if (!accessToken) return;
    try {
      await archiveEmail(accessToken, email.id);
      setSelectedThread(null); // Close the modal after successful archive
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: unknown) {
      console.error("Failed to archive email:", error); // Log the error instead of alerting
    }
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();
  
  const getColor = (initial: string) => {
    const colors = [
      'bg-emerald-100 text-emerald-600',
      'bg-blue-100 text-blue-600',
      'bg-amber-100 text-amber-600',
      'bg-purple-100 text-purple-600',
      'bg-pink-100 text-pink-600',
      'bg-indigo-100 text-indigo-600',
    ];
    const index = initial.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isToday(date)) {
        return format(date, 'HH:mm', { locale: ja });
      }
      return format(date, 'MM月dd日', { locale: ja });
    } catch {
      return dateStr;
    }
  };

  const formatFullDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'yyyy年MM月dd日 HH:mm', { locale: ja });
    } catch {
      return dateStr;
    }
  };

  // Extract sender name from "Name <email@example.com>" format
  const getSenderName = (from: string) => {
    const match = from.match(/^"?([^"<]+)"?/);
    return match ? match[1].trim() : from;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-[480px] flex flex-col overflow-hidden">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white p-6 pb-4 flex-shrink-0">メール一覧</h2>
        <div className="px-6 pb-6 space-y-6 overflow-y-auto flex-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-start gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Filter emails based on unread status
  const filteredEmails = showUnreadOnly 
    ? emails.filter(email => email.labelIds?.includes('UNREAD'))
    : emails;

  return (
    <>
      <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-[480px] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">メール一覧</h2>
          <button
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showUnreadOnly
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
            title={showUnreadOnly ? 'すべて表示' : '未読のみ表示'}
          >
            {showUnreadOnly ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
            {showUnreadOnly ? '未読のみ' : 'すべて'}
          </button>
        </div>
        <div className="px-6 pb-6 space-y-6 overflow-y-auto flex-1">
          {filteredEmails.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {showUnreadOnly ? '未読メールはありません' : 'メールはありません'}
            </p>
          ) : (
            filteredEmails.map((email) => {
              const senderName = getSenderName(email.headers.from);
              const initial = getInitial(senderName);
              const color = getColor(initial);
              
              return (
                <div 
                  key={email.id} 
                  className="flex items-start gap-4 group cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 p-2 -mx-2 rounded-lg transition-colors"
                  onClick={() => handleEmailClick(email)}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${color}`}>
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{senderName}</h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{formatTime(email.headers.date)}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{email.headers.subject}</p>
                  </div>
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Thread Detail Modal */}
      {(selectedThread || loadingThread) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e293b] rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-700">
            
            {loadingThread ? (
              <div className="p-12 flex flex-col items-center justify-center text-white">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p>スレッドを読み込み中...</p>
              </div>
            ) : currentMessage && (
              <>
                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex items-start justify-between bg-[#1e293b]">
                  <div className="flex-1 min-w-0 mr-8">
                    <h3 className="text-xl font-bold text-white leading-snug">
                      {currentMessage.headers.subject} 
                      {selectedThread!.length > 1 && (
                        <span className="ml-3 text-base font-normal text-slate-400">({selectedThread!.length}件)</span>
                      )}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setSelectedThread(null)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Action Bar */}
                <div className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between">
                  <button className="flex items-center gap-2 text-white text-sm font-medium hover:opacity-90 transition-opacity">
                    <Reply className="w-4 h-4" />
                    返信する場合はこちらから
                  </button>
                  <button
                    onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${currentMessage.id}`, '_blank')}
                    className="flex items-center gap-2 px-4 py-1.5 bg-white text-indigo-600 text-sm font-bold rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Gmailで開く
                  </button>
                  <button
                    onClick={() => handleArchive(currentMessage)}
                    className="flex items-center gap-2 px-4 py-1.5 bg-amber-100 text-amber-700 text-sm font-bold rounded-lg hover:bg-amber-200 transition-colors"
                  >
                    <Archive className="w-4 h-4" />
                    アーカイブ
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#0f172a]">
                  <div className="flex gap-4">
                    {/* Left Accent Line */}
                    <div className="w-1 bg-blue-500 rounded-full flex-shrink-0 self-stretch min-h-[200px]"></div>
                    
                    <div className="flex-1 min-w-0">
                      {/* Message Meta */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-purple-400" />
                            <span className="text-lg font-bold text-white">
                              {getSenderName(currentMessage.headers.from)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400 text-sm">
                            <span className="font-medium">宛先:</span>
                            <span className="truncate max-w-[300px]">{currentMessage.headers.to}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400 text-sm">
                            <Clock className="w-4 h-4" />
                            <span>{formatFullDate(currentMessage.headers.date)}</span>
                          </div>
                        </div>

                        {/* Pagination Badge */}
                        {selectedThread!.length > 1 && (
                          <div className="flex items-center gap-2">
                            <button 
                              disabled={currentThreadIndex === 0}
                              onClick={() => setCurrentThreadIndex(prev => prev - 1)}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                            >
                              ←
                            </button>
                            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-sm font-bold rounded-full border border-indigo-500/30">
                              {currentThreadIndex + 1}/{selectedThread!.length}
                            </span>
                            <button 
                              disabled={currentThreadIndex === selectedThread!.length - 1}
                              onClick={() => setCurrentThreadIndex(prev => prev + 1)}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                            >
                              →
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Message Content */}
                      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-slate-300 text-sm leading-relaxed">
                        <div 
                          className="prose prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: currentMessage.body || currentMessage.snippet }}
                        />
                        
                        <div className="mt-8 pt-6 border-t border-slate-700 text-slate-500 text-xs">
                          <p>From: {currentMessage.headers.from}</p>
                          <p>Date: {currentMessage.headers.date}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

