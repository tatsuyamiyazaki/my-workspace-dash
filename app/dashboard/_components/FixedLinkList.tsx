'use client';

import { useSettings } from '@/contexts/AuthContext';
import { ICON_OPTIONS } from '@/lib/constants';
import { Folder, ExternalLink } from 'lucide-react'; // Import necessary icons

export default function FixedLinkList() {
  const { fixedLinks } = useSettings();

  const getIconComponent = (iconName: string) => {
    const icon = ICON_OPTIONS.find(opt => opt.name === iconName);
    // Fallback to Folder or ExternalLink if a specific icon is not found
    if (icon) return icon.component;
    if (iconName === 'Folder') return Folder;
    return ExternalLink; 
  };

  return (
    <div className="bg-white dark:bg-[#1e293b] p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-full">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">固定リンク集</h2>
      <div className="space-y-4">
        {fixedLinks.map((link) => {
          const LinkIcon = getIconComponent(link.icon);
          return (
            <a 
              key={link.id}
              href={link.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <div className="text-blue-500">
                <LinkIcon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">{link.name}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
