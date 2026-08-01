'use server';

import db from './db';
import { revalidatePath } from 'next/cache';

export async function getUsers() {
  const stmt = db.prepare('SELECT * FROM users');
  return stmt.all() as { id: string; name: string }[];
}

export async function getDocuments(userId: string) {
  const stmt = db.prepare('SELECT * FROM documents WHERE owner_id = ? ORDER BY updated_at DESC');
  return stmt.all(userId) as { id: string; title: string; content: string; owner_id: string; updated_at: number }[];
}

export async function getSharedDocuments(userId: string) {
  const stmt = db.prepare(`
    SELECT d.* FROM documents d
    JOIN document_shares ds ON d.id = ds.document_id
    WHERE ds.user_id = ?
    ORDER BY d.updated_at DESC
  `);
  return stmt.all(userId) as { id: string; title: string; content: string; owner_id: string; updated_at: number }[];
}

export async function getDocument(id: string) {
  const stmt = db.prepare('SELECT * FROM documents WHERE id = ?');
  return stmt.get(id) as { id: string; title: string; content: string; owner_id: string; updated_at: number } | undefined;
}

export async function createDocument(userId: string, title: string, content: string = '') {
  const id = 'doc-' + Math.random().toString(36).substring(2, 9);
  const stmt = db.prepare('INSERT INTO documents (id, title, content, owner_id, updated_at) VALUES (?, ?, ?, ?, ?)');
  stmt.run(id, title, content, userId, Date.now());
  revalidatePath('/');
  return id;
}

export async function updateDocument(id: string, title: string, content: string) {
  const stmt = db.prepare('UPDATE documents SET title = ?, content = ?, updated_at = ? WHERE id = ?');
  stmt.run(title, content, Date.now(), id);
  revalidatePath('/');
  revalidatePath(`/document/${id}`);
}

export async function shareDocument(documentId: string, userId: string, permission: 'editor' | 'viewer' = 'editor') {
  // Use REPLACE to allow updating permissions for an existing share
  const stmt = db.prepare('INSERT OR REPLACE INTO document_shares (document_id, user_id, permission) VALUES (?, ?, ?)');
  stmt.run(documentId, userId, permission);
  revalidatePath('/');
}

export async function getDocumentShares(documentId: string) {
  const stmt = db.prepare(`
    SELECT u.id, u.name, ds.permission FROM users u
    JOIN document_shares ds ON u.id = ds.user_id
    WHERE ds.document_id = ?
  `);
  return stmt.all(documentId) as { id: string; name: string; permission: 'editor' | 'viewer' }[];
}

export async function deleteDocument(id: string) {
  db.prepare('DELETE FROM document_shares WHERE document_id = ?').run(id);
  db.prepare('DELETE FROM document_versions WHERE document_id = ?').run(id);
  db.prepare('DELETE FROM active_sessions WHERE document_id = ?').run(id);
  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  revalidatePath('/');
}

export async function revokeDocumentShare(documentId: string, userId: string) {
  const stmt = db.prepare('DELETE FROM document_shares WHERE document_id = ? AND user_id = ?');
  stmt.run(documentId, userId);
  revalidatePath('/');
}

export async function saveDocumentVersion(documentId: string, title: string, content: string, userId: string) {
  const versionId = 'ver-' + Math.random().toString(36).substring(2, 9);
  const stmt = db.prepare('INSERT INTO document_versions (id, document_id, title, content, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)');
  stmt.run(versionId, documentId, title, content, Date.now(), userId);
  revalidatePath(`/document/${documentId}`);
  return versionId;
}

export async function getDocumentVersions(documentId: string) {
  const stmt = db.prepare(`
    SELECT dv.*, u.name as created_by_name 
    FROM document_versions dv
    JOIN users u ON dv.created_by = u.id
    WHERE dv.document_id = ?
    ORDER BY dv.created_at DESC
  `);
  return stmt.all(documentId) as { id: string; document_id: string; title: string; content: string; created_at: number; created_by: string; created_by_name: string }[];
}

export async function pingSession(documentId: string, userId: string) {
  const stmt = db.prepare('INSERT OR REPLACE INTO active_sessions (document_id, user_id, last_seen) VALUES (?, ?, ?)');
  stmt.run(documentId, userId, Date.now());
}

export async function getActiveSessions(documentId: string) {
  const tenSecondsAgo = Date.now() - 10000;
  
  // Cleanup old sessions
  const cleanup = db.prepare('DELETE FROM active_sessions WHERE last_seen < ?');
  cleanup.run(tenSecondsAgo - 60000); 
  
  const stmt = db.prepare(`
    SELECT u.id, u.name 
    FROM active_sessions a
    JOIN users u ON a.user_id = u.id
    WHERE a.document_id = ? AND a.last_seen >= ?
  `);
  return stmt.all(documentId, tenSecondsAgo) as { id: string; name: string }[];
}
