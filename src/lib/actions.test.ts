import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createDocument, getDocument, getDocuments, shareDocument, getDocumentShares, revokeDocumentShare, saveDocumentVersion, getDocumentVersions, pingSession, getActiveSessions } from './actions';
import db, { initDb } from './db';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Document Actions', () => {
  const testUserId = 'user-1'; // User 1
  const testUserId2 = 'user-2'; // Wasiq
  let testDocId: string;

  beforeAll(async () => {
    // Only run tests if DATABASE_URL is set or we fall back to localhost
    await initDb();
  });

  afterAll(async () => {
    // End the pool after tests to allow process to exit
    await db.end();
  });

  it('should create and retrieve a document', async () => {
    testDocId = await createDocument(testUserId, 'Test Document', '<p>Hello world</p>');
    expect(testDocId).toBeDefined();

    const doc = await getDocument(testDocId);
    expect(doc).toBeDefined();
    expect(doc?.title).toBe('Test Document');
    expect(doc?.content).toBe('<p>Hello world</p>');
    expect(doc?.owner_id).toBe(testUserId);
  });

  it('should fetch documents for a user', async () => {
    const docs = await getDocuments(testUserId);
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.some(d => d.id === testDocId)).toBe(true);
  });

  it('should share a document with another user as editor by default', async () => {
    await shareDocument(testDocId, testUserId2);
    const shares = await getDocumentShares(testDocId);
    expect(shares.find(u => u.id === testUserId2)?.permission).toBe('editor');
  });

  it('should share a document with another user as viewer', async () => {
    await shareDocument(testDocId, testUserId2, 'viewer');
    const shares = await getDocumentShares(testDocId);
    expect(shares.find(u => u.id === testUserId2)?.permission).toBe('viewer');
  });

  it('should save and retrieve document versions', async () => {
    const docVerId = await createDocument('user-1', 'Ver Doc', 'init');
    const vId = await saveDocumentVersion(docVerId, 'Ver 1', 'v1 content', 'user-1');
    expect(vId).toBeDefined();

    const versions = await getDocumentVersions(docVerId);
    expect(versions).toHaveLength(1);
    expect(versions[0].title).toBe('Ver 1');
    expect(versions[0].content).toBe('v1 content');
  });

  it('should track active sessions', async () => {
    const docActiveId = await createDocument('user-1', 'Active Doc', 'init');
    await pingSession(docActiveId, 'user-1');
    await pingSession(docActiveId, 'user-2');

    const active = await getActiveSessions(docActiveId);
    expect(active).toHaveLength(2);
    expect(active.map(a => a.id).sort()).toEqual(['user-1', 'user-2']);
  });
});
