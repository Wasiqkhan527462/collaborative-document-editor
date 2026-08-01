'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getUsers } from '@/lib/actions';

type User = { id: string; name: string };

type AuthContextType = {
  currentUser: User | null;
  users: User[];
  switchUser: (id: string) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    async function loadUsers() {
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers);
      if (fetchedUsers.length > 0) {
        // Default to first user
        const storedUserId = localStorage.getItem('mockUserId');
        const storedUser = fetchedUsers.find(u => u.id === storedUserId);
        setCurrentUser(storedUser || fetchedUsers[0]);
      }
    }
    loadUsers();
  }, []);

  const switchUser = (id: string) => {
    const user = users.find((u) => u.id === id);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('mockUserId', id);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, users, switchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
