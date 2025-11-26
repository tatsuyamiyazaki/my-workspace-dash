import { useState, useEffect } from 'react';
import { Note } from '@/lib/constants';
import { Plus, Edit, Trash2, LayoutGrid, LayoutList } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeNotes, createNote, updateNote, deleteNote } from '@/lib/notesAPI';

type ViewMode = 'list' | 'grid';

const NotesWidget = () => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const storedMode = localStorage.getItem('notesViewMode');
      return (storedMode === 'grid' || storedMode === 'list') ? storedMode : 'list';
    }
    return 'list';
  });
  
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

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

  const handleAddNote = async () => {
    if (!user || !newNoteContent.trim()) return;
    
    await createNote(user.uid, newNoteContent.trim());
    setNewNoteContent('');
  };

  const handleDeleteNote = async (id: string) => {
    if (!user) return;
    await deleteNote(user.uid, id);
  };

  const handleEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  };

  const handleSaveEdit = async (id: string) => {
    if (!user || !editingNoteContent.trim()) return;
    
    await updateNote(user.uid, id, editingNoteContent.trim());
    setEditingNoteId(null);
    setEditingNoteContent('');
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingNoteContent('');
  };

  return (
    <div className="bg-white dark:bg-[#1e293b] p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">メモ</h2>
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

      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
          placeholder="新しいメモを追加"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button
          onClick={handleAddNote}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          title="メモを追加"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto ${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-4 gap-3' : 'space-y-3'}`}>
        {notes.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <p className="text-gray-500 dark:text-gray-400 text-sm">メモはありません。</p>
          </div>
        ) : (
          notes.map((note) => (
            <div 
              key={note.id} 
              className={`
                bg-gray-50 dark:bg-slate-700 p-3 rounded-lg shadow-sm flex flex-col group 
                ${viewMode === 'grid' ? 'h-[150px]' : ''}
              `}
            >
              {editingNoteId === note.id ? (
                <div className="flex flex-col h-full space-y-2">
                  <textarea
                    value={editingNoteContent}
                    onChange={(e) => setEditingNoteContent(e.target.value)}
                    className="w-full flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none text-sm resize-none"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={handleCancelEdit}
                      className="px-2 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-md transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => handleSaveEdit(note.id)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-600">
                    <p className="text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap break-words">
                      {note.content}
                    </p>
                  </div>
                  <div className={`flex justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${viewMode === 'grid' ? 'pt-2 border-t border-gray-200 dark:border-slate-600' : ''}`}>
                    <button
                      onClick={() => handleEditNote(note)}
                      className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-full transition-colors"
                      title="編集"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotesWidget;
