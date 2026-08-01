'use server';

import db from './db';
import { revalidatePath } from 'next/cache';

export async function getUsers() {
  const result = await db.query('SELECT * FROM users');
  return result.rows as { id: string; name: string }[];
}

export async function getDocuments(userId: string) {
  const result = await db.query('SELECT * FROM documents WHERE owner_id = $1 ORDER BY updated_at DESC', [userId]);
  return result.rows as { id: string; title: string; content: string; owner_id: string; updated_at: number }[];
}

export async function getSharedDocuments(userId: string) {
  const result = await db.query(`
    SELECT d.* FROM documents d
    JOIN document_shares ds ON d.id = ds.document_id
    WHERE ds.user_id = $1
    ORDER BY d.updated_at DESC
  `, [userId]);
  return result.rows as { id: string; title: string; content: string; owner_id: string; updated_at: number }[];
}

export async function getDocument(id: string) {
  const result = await db.query('SELECT * FROM documents WHERE id = $1', [id]);
  return result.rows[0] as { id: string; title: string; content: string; owner_id: string; updated_at: number } | undefined;
}

export async function createDocument(userId: string, title: string, content: string = '') {
  const id = 'doc-' + Math.random().toString(36).substring(2, 9);
  await db.query(
    'INSERT INTO documents (id, title, content, owner_id, updated_at) VALUES ($1, $2, $3, $4, $5)',
    [id, title, content, userId, Date.now()]
  );
  revalidatePath('/');
  return id;
}

export async function updateDocument(id: string, title: string, content: string) {
  await db.query(
    'UPDATE documents SET title = $1, content = $2, updated_at = $3 WHERE id = $4',
    [title, content, Date.now(), id]
  );
  revalidatePath('/');
  revalidatePath(`/document/${id}`);
}

export async function shareDocument(documentId: string, userId: string, permission: 'editor' | 'viewer' = 'editor') {
  await db.query(
    'INSERT INTO document_shares (document_id, user_id, permission) VALUES ($1, $2, $3) ON CONFLICT (document_id, user_id) DO UPDATE SET permission = EXCLUDED.permission',
    [documentId, userId, permission]
  );
  revalidatePath('/');
}

export async function getDocumentShares(documentId: string) {
  const result = await db.query(`
    SELECT u.id, u.name, ds.permission FROM users u
    JOIN document_shares ds ON u.id = ds.user_id
    WHERE ds.document_id = $1
  `, [documentId]);
  return result.rows as { id: string; name: string; permission: 'editor' | 'viewer' }[];
}

export async function deleteDocument(id: string) {
  // Execute deletions sequentially or concurrently. Doing sequentially to avoid FK issues if they exist
  await db.query('DELETE FROM document_shares WHERE document_id = $1', [id]);
  await db.query('DELETE FROM document_versions WHERE document_id = $1', [id]);
  await db.query('DELETE FROM active_sessions WHERE document_id = $1', [id]);
  await db.query('DELETE FROM documents WHERE id = $1', [id]);
  revalidatePath('/');
}

export async function revokeDocumentShare(documentId: string, userId: string) {
  await db.query('DELETE FROM document_shares WHERE document_id = $1 AND user_id = $2', [documentId, userId]);
  revalidatePath('/');
}

export async function saveDocumentVersion(documentId: string, title: string, content: string, userId: string) {
  const versionId = 'ver-' + Math.random().toString(36).substring(2, 9);
  await db.query(
    'INSERT INTO document_versions (id, document_id, title, content, created_at, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
    [versionId, documentId, title, content, Date.now(), userId]
  );
  revalidatePath(`/document/${documentId}`);
  return versionId;
}

export async function getDocumentVersions(documentId: string) {
  const result = await db.query(`
    SELECT dv.*, u.name as created_by_name 
    FROM document_versions dv
    JOIN users u ON dv.created_by = u.id
    WHERE dv.document_id = $1
    ORDER BY dv.created_at DESC
  `, [documentId]);
  return result.rows as { id: string; document_id: string; title: string; content: string; created_at: number; created_by: string; created_by_name: string }[];
}

export async function pingSession(documentId: string, userId: string) {
  await db.query(
    'INSERT INTO active_sessions (document_id, user_id, last_seen) VALUES ($1, $2, $3) ON CONFLICT (document_id, user_id) DO UPDATE SET last_seen = EXCLUDED.last_seen',
    [documentId, userId, Date.now()]
  );
}

export async function getActiveSessions(documentId: string) {
  const tenSecondsAgo = Date.now() - 10000;
  
  // Cleanup old sessions
  await db.query('DELETE FROM active_sessions WHERE last_seen < $1', [tenSecondsAgo - 60000]); 
  
  const result = await db.query(`
    SELECT u.id, u.name 
    FROM active_sessions a
    JOIN users u ON a.user_id = u.id
    WHERE a.document_id = $1 AND a.last_seen >= $2
  `, [documentId, tenSecondsAgo]);
  
  return result.rows as { id: string; name: string }[];
}
