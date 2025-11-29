'use client';

import { EmailMessage, EmailAttachment, fetchThread, markAsRead, archiveEmail, trashEmail, downloadAndOpenAttachment } from '@/lib/gmailApi';
import { format, isToday } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useState, useEffect } from 'react';
import { X, Reply, ExternalLink, User, Clock, Archive, Trash2, Maximize2, Minimize2, Paperclip, FileText, FileImage, FileSpreadsheet, File } from 'lucide-react';

interface MailListViewProps {
  emails: EmailMessage[];
  loading?: boolean;
  accessToken?: string | null;
  onRefresh?: () => void;
}

export default function MailListView({ emails, loading = false, accessToken, onRefresh }: MailListViewProps) {
  const [selectedThread, setSelectedThread] = useState<EmailMessage[] | null>(null);
  const [currentThreadIndex, setCurrentThreadIndex] = useState(0);
  const [loadingThread, setLoadingThread] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [pendingLink, setPendingLink] = useState<string | null>(null);

  // Escキー対応
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedThread) {
        setSelectedThread(null);
        setIsMaximized(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedThread]);

  const closeModal = () => {
    setSelectedThread(null);
    setIsMaximized(false);
  };

  const handleEmailClick = async (email: EmailMessage) => {
    if (!accessToken) return;

    try {
      setLoadingThread(true);
      const threadMessages = await fetchThread(accessToken, email.threadId);
      setSelectedThread(threadMessages);
      setCurrentThreadIndex(threadMessages.length - 1);
      await markAsRead(accessToken, email.id);
    } catch (error) {
      console.error("Failed to fetch thread", error);
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
      closeModal();
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: unknown) {
      console.error("Failed to archive email:", error);
    }
  };

  const handleDelete = async (email: EmailMessage) => {
    if (!accessToken) return;
    try {
      await trashEmail(accessToken, email.id);
      closeModal();
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: unknown) {
      console.error("Failed to delete email:", error);
    }
  };

  const handleBodyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href) {
      e.preventDefault();
      e.stopPropagation();
      setPendingLink(anchor.href);
    }
  };

  const confirmOpenLink = () => {
    if (pendingLink) {
      window.open(pendingLink, '_blank', 'noopener,noreferrer');
      setPendingLink(null);
    }
  };

  const cancelOpenLink = () => {
    setPendingLink(null);
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  const getColor = (initial: string) => {
    const colors = [
      'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
      'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
      'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
      'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
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

  const getSenderName = (from: string) => {
    const match = from.match(/^"?([^"<]+)"?/);
    return match ? match[1].trim() : from;
  };

  const getAttachmentIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <FileImage className="w-5 h-5" />;
    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') {
      return <FileSpreadsheet className="w-5 h-5" />;
    } else if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word') || mimeType.startsWith('text/')) {
      return <FileText className="w-5 h-5" />;
    }
    return <File className="w-5 h-5" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAttachmentDoubleClick = async (messageId: string, attachment: EmailAttachment) => {
    if (!accessToken) return;
    try {
      await downloadAndOpenAttachment(
        accessToken,
        messageId,
        attachment.attachmentId,
        attachment.filename,
        attachment.mimeType
      );
    } catch (error) {
      console.error('Failed to open attachment:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-start gap-4 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-slate-700 flex-shrink-0" />
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

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
        {emails.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">メールはありません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {emails.map((email) => {
              const senderName = getSenderName(email.headers.from);
              const initial = getInitial(senderName);
              const color = getColor(initial);
              const isUnread = email.labelIds?.includes('UNREAD');

              return (
                <div
                  key={email.id}
                  className={`flex items-start gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${
                    isUnread ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                  onClick={() => handleEmailClick(email)}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0 ${color}`}>
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className={`text-sm truncate ${isUnread ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                        {senderName}
                      </h3>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        {email.attachments && email.attachments.length > 0 && (
                          <span title={`${email.attachments.length}件の添付ファイル`}>
                            <Paperclip className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                          </span>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400">{formatTime(email.headers.date)}</span>
                      </div>
                    </div>
                    <p className={`text-sm truncate ${isUnread ? 'text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400'}`}>
                      {email.headers.subject}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">
                      {email.snippet}
                    </p>
                  </div>
                  {isUnread && (
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full mt-5 flex-shrink-0"></div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Thread Detail Modal */}
      {(selectedThread || loadingThread) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-200 dark:border-slate-700 transition-all ${
            isMaximized ? 'max-w-none max-h-none h-full m-0' : 'max-w-4xl max-h-[90vh]'
          }`}>

            {loadingThread ? (
              <div className="p-12 flex flex-col items-center justify-center text-gray-900 dark:text-white">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p>スレッドを読み込み中...</p>
              </div>
            ) : currentMessage && (
              <>
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-start justify-between bg-white dark:bg-slate-800">
                  <div className="flex-1 min-w-0 mr-8">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">
                      {currentMessage.headers.subject}
                      {selectedThread!.length > 1 && (
                        <span className="ml-3 text-base font-normal text-gray-500 dark:text-slate-400">({selectedThread!.length}件)</span>
                      )}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsMaximized(!isMaximized)}
                      className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                      title={isMaximized ? '元のサイズに戻す' : '最大化'}
                    >
                      {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={closeModal}
                      className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between gap-4 flex-wrap">
                  <button className="flex items-center gap-2 text-white text-sm font-medium hover:opacity-90 transition-opacity">
                    <Reply className="w-4 h-4" />
                    返信する場合はこちらから
                  </button>
                  <div className="flex items-center gap-2">
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
                    <button
                      onClick={() => handleDelete(currentMessage)}
                      className="flex items-center gap-2 px-4 py-1.5 bg-red-100 text-red-700 text-sm font-bold rounded-lg hover:bg-red-200 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      削除
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-slate-900">
                  <div className="flex gap-4">
                    <div className="w-1 bg-blue-500 rounded-full flex-shrink-0 self-stretch min-h-[200px]"></div>

                    <div className="flex-1 min-w-0">
                      {/* Message Meta */}
                      <div className="flex items-start justify-between mb-6">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                              {getSenderName(currentMessage.headers.from)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400 text-sm">
                            <span className="font-medium">宛先:</span>
                            <span className="truncate max-w-[300px]">{currentMessage.headers.to}</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400 text-sm">
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
                              className="p-1 text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30"
                            >
                              ←
                            </button>
                            <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-sm font-bold rounded-full border border-indigo-200 dark:border-indigo-500/30">
                              {currentThreadIndex + 1}/{selectedThread!.length}
                            </span>
                            <button
                              disabled={currentThreadIndex === selectedThread!.length - 1}
                              onClick={() => setCurrentThreadIndex(prev => prev + 1)}
                              className="p-1 text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30"
                            >
                              →
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Message Content */}
                      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-6 text-gray-700 dark:text-slate-300 text-sm leading-relaxed">
                        <div
                          className="prose dark:prose-invert max-w-none [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline [&_a]:cursor-pointer [&_a:hover]:text-blue-500 dark:[&_a:hover]:text-blue-300 [&_a]:pointer-events-auto [&_a]:relative [&_a]:z-10"
                          onClick={handleBodyClick}
                          dangerouslySetInnerHTML={{ __html: currentMessage.body || currentMessage.snippet }}
                        />

                        {/* Attachments Section */}
                        {currentMessage.attachments && currentMessage.attachments.length > 0 && (
                          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
                            <div className="flex items-center gap-2 mb-4">
                              <Paperclip className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                              <span className="text-sm font-bold text-gray-700 dark:text-slate-300">
                                添付ファイル ({currentMessage.attachments.length}件)
                              </span>
                            </div>
                            <div className="grid gap-2">
                              {currentMessage.attachments.map((attachment, idx) => (
                                <div
                                  key={`${attachment.attachmentId}-${idx}`}
                                  onDoubleClick={() => handleAttachmentDoubleClick(currentMessage.id, attachment)}
                                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors select-none"
                                  title="ダブルクリックで開く"
                                >
                                  <div className="text-blue-500 dark:text-blue-400">
                                    {getAttachmentIcon(attachment.mimeType)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {attachment.filename}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">
                                      {formatFileSize(attachment.size)}
                                    </p>
                                  </div>
                                  <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">
                                    ダブルクリックで開く
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 text-xs">
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

      {/* リンク確認ダイアログ */}
      {pendingLink && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                外部リンクを開きますか？
              </h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 dark:text-slate-300 text-sm mb-4">
                以下のリンクを新しいタブで開こうとしています。信頼できるリンクか確認してください。
              </p>
              <div className="bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg p-3 mb-4 break-all">
                <p className="text-blue-600 dark:text-blue-400 text-sm font-mono">{pendingLink}</p>
              </div>
              <p className="text-amber-600 dark:text-amber-400 text-xs">
                不審なリンクの場合はキャンセルしてください
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={cancelOpenLink}
                className="px-4 py-2 text-gray-600 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={confirmOpenLink}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                開く
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
