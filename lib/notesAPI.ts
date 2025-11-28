// lib/notesApi.ts
import { db } from "@/lib/firebase";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, onSnapshot, serverTimestamp, FieldValue 
} from "firebase/firestore";

export interface Note {
  id: string;
  content: string;
  color: string; // 背景色用 (例: 'bg-yellow-100')
  tags: string[]; // タグのリスト
  createdAt: Date;
  updatedAt: Date;
}

// メモのリアルタイム取得（リスナー）
export const subscribeNotes = (uid: string, onUpdate: (notes: Note[]) => void) => {
  const q = query(
    collection(db, "users", uid, "notes"),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const notes = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        content: data.content,
        color: data.color || 'bg-white',
        tags: data.tags || [],
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Note;
    });
    onUpdate(notes);
  });
};

// メモの作成
export const createNote = async (uid: string, content: string, color: string = 'bg-white', tags: string[] = []) => {
  await addDoc(collection(db, "users", uid, "notes"), {
    content,
    color,
    tags,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

// メモの更新
export const updateNote = async (uid: string, noteId: string, content: string, color?: string, tags?: string[]) => {
  interface NoteUpdateData {
    content: string;
    updatedAt: FieldValue;
    color?: string;
    tags?: string[];
  }

  const data: NoteUpdateData = {
    content,
    updatedAt: serverTimestamp(),
  };
  if (color) data.color = color;
  if (tags) data.tags = tags;
  
  const noteRef = doc(db, "users", uid, "notes", noteId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(noteRef, data as any); 
};

// メモの削除
export const deleteNote = async (uid: string, noteId: string) => {
  const noteRef = doc(db, "users", uid, "notes", noteId);
  await deleteDoc(noteRef);
};