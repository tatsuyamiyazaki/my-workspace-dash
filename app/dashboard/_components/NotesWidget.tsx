import { useState, useEffect, useMemo, useCallback } from 'react';
import { Note, NOTE_COLORS } from '@/lib/constants';
import { Plus, Edit, Trash2, LayoutGrid, LayoutList, Palette, X, Tag, ChevronDown } from 'lucide-react';
import { useAuth, useSettings } from '@/contexts/AuthContext';
import { subscribeNotes, createNote, updateNote, deleteNote } from '@/lib/notesAPI';

type ViewMode = 'list' | 'grid';

const NotesWidget = () => {
  const { user } = useAuth();
  const { noteGridColumns } = useSettings();
  const [notes, setNotes] = useState<Note[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const storedMode = localStorage.getItem('notesViewMode');
      return (storedMode === 'grid' || storedMode === 'list') ? storedMode : 'list';
    }
    return 'list';
  });

  // 新規メモ用のstate
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteColor, setNewNoteColor] = useState(NOTE_COLORS[0].value);
  const [newNoteTags, setNewNoteTags] = useState('');
  const [showNewColorPicker, setShowNewColorPicker] = useState(false);

  // 編集モーダル用のstate
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [editingNoteColor, setEditingNoteColor] = useState('');
  const [editingNoteTags, setEditingNoteTags] = useState('');

  // フィルタリング用のstate
  const [selectedFilterTag, setSelectedFilterTag] = useState<string | null>(null);
  const [showTagFilter, setShowTagFilter] = useState(false);

  // すべてのユニークなタグを取得
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach(note => {
      note.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [notes]);

  // フィルタリングされたメモ
  const filteredNotes = useMemo(() => {
    if (!selectedFilterTag) return notes;
    return notes.filter(note => note.tags?.includes(selectedFilterTag));
  }, [notes, selectedFilterTag]);

  // Subscribe to notes from Firestore
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeNotes(user.uid, (updatedNotes) => {
      setNotes(updatedNotes);
    });

    return () => unsubscribe();
  }, [user]);

  // Save viewMode to local storage
  useEffect(() => {
    localStorage.setItem('notesViewMode', viewMode);
  }, [viewMode]);

  // カンマ区切りのタグ文字列を配列に変換
  const parseTags = (tagString: string): string[] => {
    return tagString
      .split(/[,、]/)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  };

  const handleAddNote = async () => {
    if (!user || !newNoteContent.trim()) return;

    const tags = parseTags(newNoteTags);
    await createNote(user.uid, newNoteContent.trim(), newNoteColor, tags);
    setNewNoteContent('');
    setNewNoteColor(NOTE_COLORS[0].value);
    setNewNoteTags('');
    setShowNewColorPicker(false);
  };

  const handleDeleteNote = async (id: string) => {
    if (!user) return;
    await deleteNote(user.uid, id);
  };

  const handleEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
    setEditingNoteColor(note.color || NOTE_COLORS[0].value);
    setEditingNoteTags(note.tags?.join(', ') || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!user || !editingNoteId || !editingNoteContent.trim()) return;

    const tags = parseTags(editingNoteTags);
    await updateNote(user.uid, editingNoteId, editingNoteContent.trim(), editingNoteColor, tags);
    handleCloseModal();
  };

  const handleCloseModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingNoteId(null);
    setEditingNoteContent('');
    setEditingNoteColor('');
    setEditingNoteTags('');
  }, []);

  // Escキーでモーダルを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isEditModalOpen) {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditModalOpen, handleCloseModal]);

  // 色から対応するborderを取得
  const getBorderColor = (colorValue: string): string => {
    const colorOption = NOTE_COLORS.find(c => c.value === colorValue);
    return colorOption?.border || 'border-gray-200 dark:border-slate-600';
  };

  // ColorPickerコンポーネント（インライン版）
  const ColorPickerInline = ({
    selectedColor,
    onSelect,
    show,
    onToggle
  }: {
    selectedColor: string;
    onSelect: (color: string) => void;
    show: boolean;
    onToggle: () => void;
  }) => (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
        title="色を選択"
      >
        <Palette className="w-5 h-5 text-gray-500 dark:text-gray-400" />
      </button>
      {show && (
        <div className="absolute top-full left-0 mt-1 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-600 z-10 flex gap-1">
          {NOTE_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => {
                onSelect(color.value);
                onToggle();
              }}
              className={`w-6 h-6 rounded-full ${color.value} border-2 ${
                selectedColor === color.value
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-300 dark:border-slate-500'
              } hover:scale-110 transition-transform`}
              title={color.name}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white dark:bg-[#1e293b] p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">メモ</h2>
        <div className="flex items-center gap-2">
          {/* タグフィルター */}
          {allTags.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowTagFilter(!showTagFilter)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedFilterTag
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>{selectedFilterTag || 'タグ'}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {showTagFilter && (
                <div className="absolute top-full right-0 mt-1 w-40 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-600 z-20">
                  <button
                    onClick={() => {
                      setSelectedFilterTag(null);
                      setShowTagFilter(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-slate-700 ${
                      !selectedFilterTag ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    すべて表示
                  </button>
                  {allTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => {
                        setSelectedFilterTag(tag);
                        setShowTagFilter(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-slate-700 ${
                        selectedFilterTag === tag ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ビューモード切替 */}
          <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              title="リスト表示"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
              title="カード表示"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 新規メモ入力エリア */}
      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleAddNote()}
          placeholder="新しいメモを追加"
          className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <div className="flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700">
          <Tag className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={newNoteTags}
            onChange={(e) => setNewNoteTags(e.target.value)}
            placeholder="タグ"
            className="w-24 px-1 py-1 text-sm bg-transparent text-gray-900 dark:text-white outline-none"
          />
        </div>
        <ColorPickerInline
          selectedColor={newNoteColor}
          onSelect={setNewNoteColor}
          show={showNewColorPicker}
          onToggle={() => setShowNewColorPicker(!showNewColorPicker)}
        />
        <button
          onClick={handleAddNote}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
          title="メモを追加"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* メモ一覧 */}
      <div className={`flex-1 overflow-y-auto ${viewMode === 'grid' ? `grid gap-3 ${
        noteGridColumns === 1 ? 'grid-cols-1' :
        noteGridColumns === 2 ? 'grid-cols-1 sm:grid-cols-2' :
        noteGridColumns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      }` : 'space-y-3'}`}>
        {filteredNotes.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {selectedFilterTag ? `「${selectedFilterTag}」タグのメモはありません。` : 'メモはありません。'}
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => {
            const noteColor = note.color || NOTE_COLORS[0].value;
            const borderColor = getBorderColor(noteColor);

            return (
              <div
                key={note.id}
                className={`
                  ${noteColor} p-3 rounded-lg shadow-sm flex flex-col group border ${borderColor}
                  ${viewMode === 'grid' ? 'h-[180px]' : ''}
                `}
              >
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-600">
                  <p className="text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap break-words">
                    {note.content}
                  </p>
                </div>

                {/* タグ表示 */}
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-200/50 dark:border-slate-600/50">
                    {note.tags.map((tag, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedFilterTag(tag)}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-gray-200/70 dark:bg-slate-600/70 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {tag}
                      </button>
                    ))}
                  </div>
                )}

                <div className={`flex justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${viewMode === 'grid' ? 'pt-2 border-t border-gray-200/50 dark:border-slate-600/50' : ''}`}>
                  <button
                    onClick={() => handleEditNote(note)}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-slate-600/70 rounded-full transition-colors"
                    title="編集"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-1.5 text-red-500 hover:bg-red-100/70 dark:hover:bg-red-900/40 rounded-full transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* フィルターがアクティブな場合のクリアボタン */}
      {selectedFilterTag && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setSelectedFilterTag(null)}
            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            <X className="w-4 h-4" />
            フィルターをクリア
          </button>
        </div>
      )}

      {/* 編集モーダル */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div
            className={`w-full max-w-lg mx-4 rounded-xl shadow-2xl border ${getBorderColor(editingNoteColor)} ${editingNoteColor} overflow-hidden`}
          >
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/50 dark:border-slate-600/50">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                メモを編集
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-full hover:bg-gray-200/70 dark:hover:bg-slate-600/70 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* モーダルコンテンツ */}
            <div className="p-5 space-y-4">
              {/* メモ内容 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  内容
                </label>
                <textarea
                  value={editingNoteContent}
                  onChange={(e) => setEditingNoteContent(e.target.value)}
                  placeholder="メモの内容を入力..."
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  autoFocus
                />
              </div>

              {/* 色選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <Palette className="w-4 h-4 inline-block mr-1" />
                  色
                </label>
                <div className="flex gap-2">
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setEditingNoteColor(color.value)}
                      className={`w-8 h-8 rounded-full ${color.value} border-2 ${
                        editingNoteColor === color.value
                          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                          : 'border-gray-300 dark:border-slate-500'
                      } hover:scale-110 transition-transform`}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* タグ入力 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <Tag className="w-4 h-4 inline-block mr-1" />
                  タグ
                </label>
                <input
                  type="text"
                  value={editingNoteTags}
                  onChange={(e) => setEditingNoteTags(e.target.value)}
                  placeholder="カンマ区切り: 仕事, アイデア, 重要"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* モーダルフッター */}
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-200/50 dark:border-slate-600/50">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesWidget;
