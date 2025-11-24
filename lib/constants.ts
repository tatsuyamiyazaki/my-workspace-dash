import {
  Folder, ExternalLink
} from 'lucide-react';

export interface Note {
  id: string;
  content: string;
  createdAt: string;
}

export const ICON_OPTIONS = [
  { name: 'Folder', component: Folder },
  { name: 'ExternalLink', component: ExternalLink },
];
