'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDocuments, getSharedDocuments, createDocument, deleteDocument } from '@/lib/actions';
import { FileText, Plus, Upload, Users, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Doc = { id: string; title: string; content: string; updated_at: number; owner_id: string };

export default function Dashboard() {
  const { currentUser } = useAuth();
  const router = useRouter();
  
  const [myDocs, setMyDocs] = useState<Doc[]>([]);
  const [sharedDocs, setSharedDocs] = useState<Doc[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser) {
      loadDocuments();
    }
  }, [currentUser]);

  async function loadDocuments() {
    if (!currentUser) return;
    const mine = await getDocuments(currentUser.id);
    const shared = await getSharedDocuments(currentUser.id);
    setMyDocs(mine);
    setSharedDocs(shared);
  }

  async function handleCreateNew() {
    if (!currentUser) return;
    setIsCreating(true);
    try {
      const docId = await createDocument(currentUser.id, 'Untitled Document', '');
      router.push(`/document/${docId}`);
    } catch (e) {
      console.error(e);
      setIsCreating(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
      alert('Only .txt and .md files are supported.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setIsCreating(true);
      try {
        const title = file.name.replace(/\.[^/.]+$/, "");
        // Convert basic newlines to HTML paragraphs for Tiptap
        const htmlContent = text.split('\\n').map(line => `<p>${line}</p>`).join('');
        const docId = await createDocument(currentUser.id, title, htmlContent);
        router.push(`/document/${docId}`);
      } catch (e) {
        console.error(e);
        setIsCreating(false);
      }
    };
    reader.readAsText(file);
  }

  if (!currentUser) {
    return <div style={{ textAlign: 'center', marginTop: '4rem' }}>Loading user...</div>;
  }

  async function handleDelete(e: React.MouseEvent, docId: string) {
    e.preventDefault();
    if (confirm('Are you sure you want to delete this document?')) {
      await deleteDocument(docId);
      loadDocuments();
    }
  }

  const DocumentCard = ({ doc, shared }: { doc: Doc; shared?: boolean }) => (
    <Link href={`/document/${doc.id}`} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', transition: 'transform 0.2s, box-shadow 0.2s', textDecoration: 'none', color: 'inherit', position: 'relative' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <FileText size={32} color={shared ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {shared && <Users size={16} color="var(--text-tertiary)" />}
          {!shared && (
            <button 
              onClick={(e) => handleDelete(e, doc.id)}
              style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem', display: 'flex', opacity: 0.7 }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
              title="Delete Document"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.25rem' }}>{doc.title || 'Untitled Document'}</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
          Last updated: {new Date(doc.updated_at).toLocaleDateString()}
        </p>
      </div>
    </Link>
  );

  return (
    <div className="animate-fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Welcome back, {currentUser.name}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Create or open a document to start collaborating.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input 
            type="file" 
            accept=".txt,.md" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileUpload} 
          />
          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={isCreating}>
            <Upload size={18} /> Upload File (.txt, .md)
          </button>
          <button className="btn-primary" onClick={handleCreateNew} disabled={isCreating}>
            <Plus size={18} /> {isCreating ? 'Creating...' : 'Create New'}
          </button>
        </div>
      </header>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          My Documents
        </h2>
        {myDocs.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            You don't have any documents yet. Create one to get started!
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
            {myDocs.map(doc => <DocumentCard key={doc.id} doc={doc} />)}
          </div>
        )}
      </section>

      <section style={{ marginBottom: '4rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Shared with me
        </h2>
        {sharedDocs.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No documents have been shared with you.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
            {sharedDocs.map(doc => <DocumentCard key={doc.id} doc={doc} shared />)}
          </div>
        )}
      </section>
    </div>
  );
}
