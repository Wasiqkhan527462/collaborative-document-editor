'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const { currentUser, users, switchUser } = useAuth();
  const pathname = usePathname();

  return (
    <nav className="glass-panel" style={{ padding: '1rem 2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0', borderLeft: 'none', borderRight: 'none', borderTop: 'none', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
          <FileText size={24} />
          CollabDocs
        </Link>
        {pathname !== '/' && (
          <Link href="/" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginLeft: '1rem' }}>
            ← Back to Dashboard
          </Link>
        )}
      </div>

      {currentUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
            <User size={18} />
            <span style={{ fontSize: '0.9rem' }}>Acting as:</span>
            <select 
              value={currentUser.id} 
              onChange={(e) => switchUser(e.target.value)}
              style={{ padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', fontFamily: 'inherit', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </nav>
  );
}
