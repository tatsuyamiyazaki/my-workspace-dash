import { Folder, MessageSquare, FileText, ChevronRight, Plus } from 'lucide-react';

export default function LinkList() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Fixed Links */}
      <div className="bg-white dark:bg-[#1e293b] p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-full">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">固定リンク集</h2>
        <div className="space-y-4">
          <a href="#" className="flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <div className="text-blue-500">
              <Folder className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">ワークドライブ</span>
          </a>
          <a href="#" className="flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <div className="text-blue-500">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">チームチャット</span>
          </a>
          <a href="#" className="flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <div className="text-blue-500">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">ニュースフィード</span>
          </a>
        </div>
      </div>

      {/* Custom Links */}
      <div className="bg-white dark:bg-[#1e293b] p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">カスタムリンク集</h2>
          <button className="p-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <a href="#" className="flex items-center justify-between group">
            <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              <div className="text-blue-500">
                <Folder className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">プロジェクト</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </a>
          <a href="#" className="flex items-center justify-between group">
            <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              <div className="text-blue-500">
                <Folder className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">学習</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </a>
        </div>
      </div>
    </div>
  );
}
