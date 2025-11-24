'use client';

import { useState } from 'react';
import { 
  Folder, ChevronRight, Plus, X, Trash2, Edit2,
  ChevronDown, FolderPlus, ExternalLink
} from 'lucide-react';
import { ICON_OPTIONS } from '@/lib/constants';
import { useSettings, CustomLink, LinkFolder } from '@/contexts/AuthContext';

export default function CustomLinkList() {
  const { 
    customLinks, setCustomLinks,
    folders, setFolders
   } = useSettings();
  const [editingLink, setEditingLink] = useState<CustomLink | null>(null);
  const [editingFolder, setEditingFolder] = useState<LinkFolder | null>(null);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const saveLinks = (links: CustomLink[]) => {
    setCustomLinks(links);
  };

  const saveFolders = (newFolders: LinkFolder[]) => {
    setFolders(newFolders);
  };

  const handleCreateLinkClick = (folderId?: string) => {
    setEditingLink({
      id: '',
      name: '',
      url: '',
      icon: 'ExternalLink',
      folderId,
    });
    setIsCreatingLink(true);
  };

  const handleCreateFolderClick = () => {
    setEditingFolder({
      id: '',
      name: '',
      icon: 'Folder',
      isExpanded: true,
    });
    setIsCreatingFolder(true);
  };

  const handleEditLinkClick = (link: CustomLink, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingLink(link);
    setIsCreatingLink(false);
  };

  const handleEditFolderClick = (folder: LinkFolder, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingFolder(folder);
    setIsCreatingFolder(false);
  };

  const handleSaveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink) return;

    if (isCreatingLink) {
      const newLink = { ...editingLink, id: Date.now().toString() };
      saveLinks([...customLinks, newLink]);
    } else {
      saveLinks(customLinks.map(link => link.id === editingLink.id ? editingLink : link));
    }
    setEditingLink(null);
    setIsCreatingLink(false);
  };

  const handleSaveFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder) return;

    if (isCreatingFolder) {
      const newFolder = { ...editingFolder, id: Date.now().toString() };
      saveFolders([...folders, newFolder]);
    } else {
      saveFolders(folders.map(folder => folder.id === editingFolder.id ? editingFolder : folder));
    }
    setEditingFolder(null);
    setIsCreatingFolder(false);
  };

  const handleDeleteLink = () => {
    if (!editingLink || !confirm('このリンクを削除してもよろしいですか?')) return;
    saveLinks(customLinks.filter(link => link.id !== editingLink.id));
    setEditingLink(null);
    setIsCreatingLink(false);
  };

  const handleDeleteFolder = () => {
    if (!editingFolder || !confirm('このフォルダと中のリンクを削除してもよろしいですか?')) return;
    saveLinks(customLinks.filter(link => link.folderId !== editingFolder.id));
    saveFolders(folders.filter(folder => folder.id !== editingFolder.id));
    setEditingFolder(null);
    setIsCreatingFolder(false);
  };

  const toggleFolder = (folderId: string) => {
    saveFolders(folders.map(folder => 
      folder.id === folderId ? { ...folder, isExpanded: !folder.isExpanded } : folder
    ));
  };

  const getIconComponent = (iconName: string) => {
    const icon = ICON_OPTIONS.find(opt => opt.name === iconName);
    return icon ? icon.component : ExternalLink;
  };

  const unorganizedLinks = customLinks.filter(link => !link.folderId);

  return (
    <div className="bg-white dark:bg-[#1e293b] p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">カスタムリンク集</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleCreateFolderClick}
            className="p-1 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            title="フォルダを作成"
          >
            <FolderPlus className="w-5 h-5" />
          </button>
          <button 
            onClick={() => handleCreateLinkClick()}
            className="p-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            title="リンクを作成"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="space-y-3 overflow-y-auto max-h-[400px]">
        {folders.length === 0 && customLinks.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            カスタムリンクはありません
          </div>
        ) : (
          <>
            {/* Folders */}
            {folders.map((folder) => {
              const folderLinks = customLinks.filter(link => link.folderId === folder.id);
              return (
                <div key={folder.id} className="space-y-2">
                  <div className="flex items-center justify-between group">
                    <button
                      onClick={() => toggleFolder(folder.id)}
                      className="flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-1 text-left"
                    >
                      <div className="text-blue-500">
                        {folder.isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                      <Folder className="w-5 h-5 text-yellow-500" />
                      <span className="text-sm font-semibold">{folder.name}</span>
                      <span className="text-xs text-gray-400">({folderLinks.length})</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCreateLinkClick(folder.id)}
                        className="p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="リンクを追加"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleEditFolderClick(folder, e)}
                        className="p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="フォルダを編集"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {folder.isExpanded && (
                    <div className="ml-6 border-l-2 border-gray-200 dark:border-slate-700 pl-3 grid grid-cols-2 gap-2">
                      {folderLinks.length === 0 ? (
                        <div className="text-xs text-gray-400 py-2 col-span-2">リンクはありません</div>
                      ) : (
                        folderLinks.map((link) => {
                          const LinkIcon = getIconComponent(link.icon);
                          return (
                            <div key={link.id} className="flex items-center justify-between group/link">
                              <a 
                                href={link.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-1"
                              >
                                <LinkIcon className="w-4 h-4 text-blue-500" />
                                <span className="text-sm">{link.name}</span>
                              </a>
                              <button
                                onClick={(e) => handleEditLinkClick(link, e)}
                                className="p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors opacity-0 group-hover/link:opacity-100"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unorganized Links */}
            {unorganizedLinks.length > 0 && (
              <div className="pt-2 border-t border-gray-200 dark:border-slate-700 grid grid-cols-2 gap-2">
                {unorganizedLinks.map((link) => {
                  const LinkIcon = getIconComponent(link.icon);
                  return (
                    <div key={link.id} className="flex items-center justify-between group">
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-1"
                      >
                        <LinkIcon className="w-5 h-5 text-blue-500" />
                        <span className="text-sm font-medium">{link.name}</span>
                      </a>
                      <button
                        onClick={(e) => handleEditLinkClick(link, e)}
                        className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit/Create Link Modal */}
      {editingLink && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <form onSubmit={handleSaveLink}>
              <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-900/50">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {isCreatingLink ? 'リンクの作成' : 'リンクの編集'}
                </h3>
                <button 
                  type="button"
                  onClick={() => {
                    setEditingLink(null);
                    setIsCreatingLink(false);
                  }}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名前</label>
                  <input
                    type="text"
                    value={editingLink.name}
                    onChange={(e) => setEditingLink({ ...editingLink, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                    placeholder="リンク名を入力"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL</label>
                  <input
                    type="url"
                    value={editingLink.url}
                    onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">フォルダ</label>
                  <select
                    value={editingLink.folderId || ''}
                    onChange={(e) => setEditingLink({ ...editingLink, folderId: e.target.value || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">フォルダなし</option>
                    {folders.map(folder => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">アイコン</label>
                  <div className="grid grid-cols-6 gap-2 max-h-[240px] overflow-y-auto pr-2">
                    {ICON_OPTIONS.map((iconOption) => {
                      const IconComp = iconOption.component;
                      return (
                        <button
                          key={iconOption.name}
                          type="button"
                          onClick={() => setEditingLink({ ...editingLink, icon: iconOption.name })}
                          className={`p-2.5 rounded-lg border-2 transition-all ${
                            editingLink.icon === iconOption.name
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                              : 'border-gray-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-700 text-gray-500 dark:text-gray-400'
                          }`}
                          title={iconOption.name}
                        >
                          <IconComp className="w-5 h-5 mx-auto" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center">
                {!isCreatingLink ? (
                  <button
                    type="button"
                    onClick={handleDeleteLink}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    削除
                  </button>
                ) : (
                  <div></div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLink(null);
                      setIsCreatingLink(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                  >
                    保存
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit/Create Folder Modal */}
      {editingFolder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <form onSubmit={handleSaveFolder}>
              <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-900/50">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {isCreatingFolder ? 'フォルダの作成' : 'フォルダの編集'}
                </h3>
                <button 
                  type="button"
                  onClick={() => {
                    setEditingFolder(null);
                    setIsCreatingFolder(false);
                  }}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">フォルダ名</label>
                  <input
                    type="text"
                    value={editingFolder.name}
                    onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                    placeholder="フォルダ名を入力"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">アイコン</label>
                  <div className="grid grid-cols-6 gap-2 max-h-[240px] overflow-y-auto pr-2">
                    {ICON_OPTIONS.map((iconOption) => {
                      const IconComp = iconOption.component;
                      return (
                        <button
                          key={iconOption.name}
                          type="button"
                          onClick={() => setEditingFolder({ ...editingFolder, icon: iconOption.name })}
                          className={`p-2.5 rounded-lg border-2 transition-all ${
                            editingFolder.icon === iconOption.name
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                              : 'border-gray-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-700 text-gray-500 dark:text-gray-400'
                          }`}
                          title={iconOption.name}
                        >
                          <IconComp className="w-5 h-5 mx-auto" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center">
                {!isCreatingFolder ? (
                  <button
                    type="button"
                    onClick={handleDeleteFolder}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    削除
                  </button>
                ) : (
                  <div></div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFolder(null);
                      setIsCreatingFolder(false);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
                  >
                    保存
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div >
  );
}
