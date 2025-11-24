import { useState, useEffect } from 'react';
import { Note } from '@/lib/constants';
import { Plus, Edit, Trash2 } from 'lucide-react';

const NotesWidget = () => {
  const [notes, setNotes] = useState<Note[]>(() => {
    const storedNotes = localStorage.getItem('dashboardNotes');
    return storedNotes ? JSON.parse(storedNotes) : [];
  });
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

  // Save notes to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('dashboardNotes', JSON.stringify(notes));
  }, [notes]);

  const handleAddNote = () => {
    if (newNoteContent.trim()) {
      const newNote: Note = {
        id: Date.now().toString(),
        content: newNoteContent.trim(),
        createdAt: new Date().toISOString(),
      };
      setNotes([...notes, newNote]);
      setNewNoteContent('');
    }
  };

  const handleDeleteNote = (id: string) => {
    setNotes(notes.filter(note => note.id !== id));
  };

  const handleEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  };

  const handleSaveEdit = (id: string) => {
    setNotes(notes.map(note =>
      note.id === id ? { ...note, content: editingNoteContent.trim() } : note
    ));
    setEditingNoteId(null);
    setEditingNoteContent('');
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingNoteContent('');
  };

  return (
    <div className="bg-white dark:bg-[#1e293b] p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-full flex flex-col">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">メモ</h2>
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

      <div className="flex-1 overflow-y-auto space-y-3">
        {notes.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">メモはありません。</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="bg-gray-50 dark:bg-slate-700 p-3 rounded-lg shadow-sm flex flex-col group">
              {editingNoteId === note.id ? (
                <div className="flex flex-col space-y-2">
                  <textarea
                    value={editingNoteContent}
                    onChange={(e) => setEditingNoteContent(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 outline-none text-sm"
                    rows={3}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-md transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={() => handleSaveEdit(note.id)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-gray-800 dark:text-gray-200 text-sm whitespace-pre-wrap flex-1">{note.content}</p>
                  <div className="flex justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => handleEditNote(note)}
                      className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-full transition-colors"
                      title="編集"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
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
