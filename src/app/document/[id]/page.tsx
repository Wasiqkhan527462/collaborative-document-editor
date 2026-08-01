'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDocument, updateDocument, shareDocument, getDocumentShares, revokeDocumentShare, saveDocumentVersion, getDocumentVersions, pingSession, getActiveSessions } from '@/lib/actions';
import { useEditor, EditorContent } from '@tiptap/react';
import { Mark, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { Share2, Bold, Italic, Underline as UnderlineIcon, Heading1, Heading2, List, ListOrdered, X, Download, Printer, Save, History, MessageSquarePlus, Clock, RotateCcw, Users, UserPlus, Check, Shield, ChevronDown } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import TurndownService from 'turndown';

const CommentMark = Mark.create({
  name: 'comment',
  addAttributes() {
    return {
      comment: {
        default: null,
        parseHTML: element => element.getAttribute('data-comment'),
        renderHTML: attributes => {
          if (!attributes.comment) return {};
          return {
            'data-comment': attributes.comment,
            'class': 'tiptap-comment'
          };
        },
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-comment]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});

export default function DocumentEditor() {
  const params = useParams();
  const id = params.id as string;
  const { currentUser, users } = useAuth();
  const router = useRouter();

  const [doc, setDoc] = useState<{ title: string; content: string; owner_id: string } | null>(null);
  const [shares, setShares] = useState<{ id: string; name: string; permission: 'editor' | 'viewer' }[]>([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedUserToShare, setSelectedUserToShare] = useState('');
  const [selectedPermission, setSelectedPermission] = useState<'editor' | 'viewer'>('editor');
  const [isViewer, setIsViewer] = useState(false);
  
  const [versions, setVersions] = useState<any[]>([]);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  
  const [activeUsers, setActiveUsers] = useState<{ id: string; name: string }[]>([]);
  
  const [title, setTitle] = useState('');
  const titleRef = useRef(title);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  const [restoreContent, setRestoreContent] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<any>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { WebrtcProvider } = require('y-webrtc');
    const p = new WebrtcProvider(`collabdocs-room-${id}`, ydoc);
    setProvider(p);
    
    return () => {
      p.destroy();
    };
  }, [id, ydoc]);

  // Poll for active sessions
  useEffect(() => {
    if (!currentUser) return;
    const userId = currentUser.id;
    const ping = async () => {
      await pingSession(id, userId);
      const active = await getActiveSessions(id);
      setActiveUsers(active);
    };
    
    ping();
    const interval = setInterval(ping, 5000);
    return () => clearInterval(interval);
  }, [id, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const userId = currentUser.id;
    async function load() {
      const data = await getDocument(id);
      if (!data) {
        alert('Document not found.');
        router.push('/');
        return;
      }
      
      const sharedUsers = await getDocumentShares(id);
      setShares(sharedUsers);
      
      const isOwner = data.owner_id === userId;
      const shareData = sharedUsers.find(u => u.id === userId);
      const isShared = !!shareData;
      
      if (!isOwner && !isShared) {
        alert('You do not have permission to view this document.');
        router.push('/');
        return;
      }
      
      const viewerMode = !isOwner && shareData?.permission === 'viewer';
      setIsViewer(viewerMode);
      
      setDoc(data);
      setTitle(data.title);
      titleRef.current = data.title; // Update synchronously
      lastSnapshotContentRef.current = data.content; // Track initial content
      
      setIsEditorReady(true);
    }
    load();
  }, [id, currentUser, router]);

  // Auto-Snapshot every 1 minute if changed
  const lastSnapshotContentRef = useRef('');
  useEffect(() => {
    if (!currentUser || isViewer) return;
    const userId = currentUser.id;

    const interval = setInterval(async () => {
      const htmlContent = document.querySelector('.ProseMirror')?.innerHTML || '';
      // Only save if it has actually changed since last snapshot
      if (htmlContent && htmlContent !== '<p></p>' && htmlContent !== lastSnapshotContentRef.current) {
        await saveDocumentVersion(id, titleRef.current || 'Auto Save', htmlContent, userId);
        lastSnapshotContentRef.current = htmlContent;
      }
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [id, currentUser, isViewer]);

  const handleAutoSave = useCallback((newTitle: string, newContent: string) => {
    setIsSaving(true);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      await updateDocument(id, newTitle, newContent);
      setIsSaving(false);
    }, 1000);
  }, [id]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    titleRef.current = newTitle;
    handleAutoSave(newTitle, '');
  };

  const handleShare = async () => {
    if (!selectedUserToShare) return;
    await shareDocument(id, selectedUserToShare, selectedPermission);
    const updatedShares = await getDocumentShares(id);
    setShares(updatedShares);
    setIsShareModalOpen(false);
    setSelectedUserToShare('');
    setSelectedPermission('editor');
  };

  const handleUpdatePermission = async (userId: string, newPermission: 'editor' | 'viewer') => {
    await shareDocument(id, userId, newPermission);
    const updatedShares = await getDocumentShares(id);
    setShares(updatedShares);
  };

  const handleRevoke = async (userId: string) => {
    await revokeDocumentShare(id, userId);
    const updatedShares = await getDocumentShares(id);
    setShares(updatedShares);
  };

  const handleExportMarkdown = () => {
    const turndownService = new TurndownService();
    const htmlContent = document.querySelector('.ProseMirror')?.innerHTML || '';
    const markdown = turndownService.turndown(htmlContent);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'document'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleSaveVersion = async () => {
    if (!currentUser) return;
    const htmlContent = document.querySelector('.ProseMirror')?.innerHTML || '';
    await saveDocumentVersion(id, titleRef.current, htmlContent, currentUser.id);
    lastSnapshotContentRef.current = htmlContent;
    showToast('Snapshot saved successfully!');
  };

  const handleOpenHistory = async () => {
    const fetchedVersions = await getDocumentVersions(id);
    setVersions(fetchedVersions);
    setIsVersionModalOpen(true);
  };

  const handleRestoreVersion = (version: any) => {
    setTitle(version.title);
    titleRef.current = version.title;
    setRestoreContent(version.content);
    setIsVersionModalOpen(false);
    
    // Also trigger save immediately to persist the restored version
    handleAutoSave(version.title, version.content);
    showToast('Version restored successfully!');
  };

  if (!currentUser || !doc) return <div style={{ textAlign: 'center', marginTop: '4rem' }}>Loading...</div>;

  const isOwner = doc.owner_id === currentUser.id;
  const unsharedUsers = users.filter(u => u.id !== doc.owner_id && !shares.some(su => su.id === u.id));

  return (
    <>
      <div className="animate-fade-in" style={{ paddingBottom: '5rem' }}>
        <header className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled Document"
          disabled={isViewer}
          style={{ fontSize: '2rem', fontWeight: 700, border: 'none', background: 'transparent', outline: 'none', flex: 1, color: 'var(--text-primary)' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {activeUsers.length > 1 && (
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginRight: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active:</span>
              <div style={{ display: 'flex' }}>
                {activeUsers.filter(u => u.id !== currentUser?.id).map(u => (
                  <div key={u.id} title={u.name} style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, border: '2px solid var(--bg-primary)', marginLeft: '-8px' }}>
                    {u.name.charAt(0)}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!isViewer && (
            <>
              <button className="btn-secondary" onClick={handleSaveVersion} title="Save Snapshot">
                <Save size={16} />
              </button>
              <button className="btn-secondary" onClick={handleOpenHistory} title="Version History">
                <History size={16} />
              </button>
            </>
          )}
          <button className="btn-secondary" onClick={handleExportMarkdown} title="Export Markdown">
            <Download size={16} />
          </button>
          <button className="btn-secondary" onClick={handleExportPDF} title="Print / Export PDF">
            <Printer size={16} />
          </button>
          <div style={{ width: '1px', background: 'var(--border-color)', height: '24px', margin: '0 0.5rem' }} />
          {isViewer ? (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
              Viewing Only
            </span>
          ) : (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
              {isSaving ? 'Saving...' : 'Saved'}
            </span>
          )}
          {isOwner && (
            <button className="btn-primary" onClick={() => setIsShareModalOpen(true)}>
              <Share2 size={16} /> Share
            </button>
          )}
        </div>
      </header>

      {provider && isEditorReady ? (
        <LiveEditor 
          ydoc={ydoc} 
          provider={provider} 
          currentUser={currentUser} 
          isViewer={isViewer} 
          handleAutoSave={handleAutoSave}
          titleRef={titleRef}
          initialContent={doc.content}
          restoreContent={restoreContent}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Connecting to collaborative session...</div>
      )}
      </div>

      {isShareModalOpen && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <div className="premium-modal" style={{ padding: '2.5rem', width: '500px', maxWidth: '90%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: 'var(--accent-light)', padding: '0.75rem', borderRadius: '50%', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Share Document</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>Invite others to collaborate in real-time.</p>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} style={{ marginLeft: 'auto', color: 'var(--text-secondary)', padding: '0.25rem', cursor: 'pointer', background: 'var(--bg-tertiary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}><X size={18} /></button>
            </div>
            
            <div style={{ marginBottom: '2rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Invite users</label>
                <CustomDropdown 
                  value={selectedUserToShare}
                  onChange={setSelectedUserToShare}
                  options={unsharedUsers.map(u => ({ value: u.id, label: u.name }))}
                  placeholder="Select someone..."
                  icon={<Users size={16} />}
                />
              </div>
              <div style={{ width: '130px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'transparent' }}>Role</label>
                <CustomDropdown 
                  value={selectedPermission}
                  onChange={(val: any) => setSelectedPermission(val)}
                  options={[{value: 'editor', label: 'Editor'}, {value: 'viewer', label: 'Viewer'}]}
                  placeholder="Role"
                />
              </div>
              <button className="btn-primary" style={{ padding: '0.65rem 1.25rem', height: '42px', boxShadow: 'var(--shadow-md)' }} onClick={handleShare} disabled={!selectedUserToShare}>
                Invite
              </button>
            </div>

            {shares.length > 0 && (
              <div style={{ marginTop: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <Shield size={16} color="var(--text-secondary)" />
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>People with access</h4>
                </div>
                <ul className="custom-scrollbar" style={{ listStyle: 'none', padding: 0, maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  <li style={{ padding: '0.75rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 600, boxShadow: 'var(--shadow-sm)' }}>
                        {currentUser.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{currentUser.name} (You)</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Owner</div>
                      </div>
                    </div>
                  </li>
                  {shares.map(s => (
                    <li key={s.id} style={{ padding: '0.75rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 600, border: '1px solid var(--border-color)' }}>
                          {s.name.charAt(0)}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <CustomDropdown 
                          value={s.permission}
                          onChange={(val: any) => handleUpdatePermission(s.id, val)}
                          options={[{value: 'editor', label: 'Editor'}, {value: 'viewer', label: 'Viewer'}]}
                          width="110px"
                        />
                        <button onClick={() => handleRevoke(s.id)} style={{ color: 'var(--danger)', padding: '0.4rem', display: 'flex', alignItems: 'center', borderRadius: '50%', transition: 'all 0.2s', border: '1px solid transparent' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }} title="Remove access">
                          <X size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {isVersionModalOpen && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <div className="premium-modal" style={{ padding: '2.5rem', width: '600px', maxWidth: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', flexShrink: 0 }}>
              <div style={{ background: 'var(--accent-light)', padding: '0.75rem', borderRadius: '50%', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Version History</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>Restore previous snapshots of this document.</p>
              </div>
              <button onClick={() => setIsVersionModalOpen(false)} style={{ marginLeft: 'auto', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem', background: 'var(--bg-tertiary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px' }}><X size={18} /></button>
            </div>
            
            <div className="custom-scrollbar" style={{ overflowY: 'auto', flex: 1, paddingRight: '0.75rem' }}>
              {versions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-tertiary)' }}>
                  <History size={48} style={{ margin: '0 auto 1.5rem', opacity: 0.3 }} />
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No snapshots saved yet.</h4>
                  <p style={{ fontSize: '0.9rem', marginTop: '0.5rem', maxWidth: '300px', margin: '0.5rem auto' }}>Snapshots save automatically every minute while editing, or manually via the save button.</p>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {versions.map((v, index) => (
                    <li key={v.id} style={{ padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', background: index === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)', position: 'relative', overflow: 'hidden', transition: 'box-shadow 0.2s', boxShadow: 'var(--shadow-sm)' }} onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'} onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}>
                      {index === 0 && <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', background: 'var(--accent-primary)' }} />}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{v.title}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600, background: 'var(--accent-light)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)' }}>
                          {new Date(v.created_at).toLocaleDateString()} at {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--text-tertiary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                            {v.created_by_name.charAt(0)}
                          </div>
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Saved by {v.created_by_name}</span>
                        </div>
                        {!isViewer && (
                          <button className="btn-secondary" onClick={() => handleRestoreVersion(v)} style={{ padding: '0.4rem 0.85rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-primary)'; }}>
                            <RotateCcw size={16} /> Restore
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-enter" style={{ position: 'fixed', bottom: '2.5rem', left: '50%', background: 'var(--text-primary)', color: 'var(--bg-primary)', padding: '0.85rem 1.75rem', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.4)', zIndex: 100, fontWeight: 500, fontSize: '0.95rem' }}>
          <div style={{ background: 'var(--success)', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={14} style={{ color: 'white', strokeWidth: 3 }} />
          </div>
          {toastMessage}
        </div>
      )}
    </>
  );
}

function LiveEditor({ ydoc, provider, currentUser, isViewer, handleAutoSave, titleRef, initialContent, restoreContent }: any) {
  const editor = useEditor({
    extensions: [
      // @ts-ignore - history exists but is typed incorrectly in this version
      StarterKit.configure({ history: false }), 
      Underline, 
      CommentMark,
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider: provider,
        user: { 
          name: currentUser.name, 
          color: currentUser.id === 'user-1' ? '#facc15' : currentUser.id === 'user-2' ? '#3b82f6' : '#ef4444' 
        },
      })
    ],
    content: '',
    editable: !isViewer,
    onUpdate: ({ editor }) => {
      handleAutoSave(titleRef.current, editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && ydoc.getXmlFragment('default').length === 0 && initialContent) {
      editor.commands.setContent(initialContent);
    }
  }, [editor, initialContent, ydoc]);

  useEffect(() => {
    if (editor && restoreContent) {
      editor.commands.setContent(restoreContent);
    }
  }, [editor, restoreContent]);

  if (!editor) return null;

  return (
    <>
      {!isViewer && (
        <div className="glass-panel no-print" style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', position: 'sticky', top: '70px', zIndex: 9, marginBottom: '1rem' }}>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} icon={<Bold size={18} />} />
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} icon={<Italic size={18} />} />
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} icon={<UnderlineIcon size={18} />} />
          <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 0.5rem' }} />
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} icon={<Heading1 size={18} />} />
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} icon={<Heading2 size={18} />} />
          <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 0.5rem' }} />
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} icon={<List size={18} />} />
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} icon={<ListOrdered size={18} />} />
          <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 0.5rem' }} />
          <ToolbarButton 
            onClick={() => {
              const text = window.prompt('Enter your comment:');
              if (text) editor.chain().focus().setMark('comment', { comment: text }).run();
            }} 
            active={editor.isActive('comment')} 
            icon={<MessageSquarePlus size={18} />} 
          />
        </div>
      )}
      <EditorContent editor={editor} />
    </>
  );
}

function CustomDropdown({ value, onChange, options, placeholder, icon, width = '100%' }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o: any) => o.value === value);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  return (
    <div ref={dropdownRef} style={{ position: 'relative', width }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          padding: '0.65rem 1rem', paddingLeft: icon ? '2.5rem' : '1rem',
          background: 'var(--bg-primary)', border: isOpen ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'all 0.2s', boxShadow: isOpen ? '0 0 0 3px var(--accent-light)' : 'none',
          height: '42px'
        }}
      >
        {icon && <div style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-tertiary)', display: 'flex' }}>{icon}</div>}
        <span style={{ color: selectedOption ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '0.5rem' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} color="var(--text-tertiary)" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </div>
      {isOpen && (
        <div className="animate-fade-in" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', zIndex: 60, maxHeight: '200px', overflowY: 'auto' }}>
          {options.map((o: any) => (
            <div 
              key={o.value} 
              onClick={() => { onChange(o.value); setIsOpen(false); }}
              style={{ padding: '0.6rem 1rem', cursor: 'pointer', background: value === o.value ? 'var(--bg-tertiary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-primary)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
              onMouseLeave={e => e.currentTarget.style.background = value === o.value ? 'var(--bg-tertiary)' : 'transparent'}
            >
              {o.label}
              {value === o.value && <Check size={14} color="var(--accent-primary)" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ onClick, active, icon }: { onClick: () => void, active: boolean, icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.5rem',
        borderRadius: 'var(--radius-sm)',
        background: active ? 'var(--accent-light)' : 'transparent',
        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--bg-tertiary)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      {icon}
    </button>
  );
}
