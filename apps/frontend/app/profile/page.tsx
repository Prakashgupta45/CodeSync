'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import { RoomDto } from '@codesync/shared';
import { AppShell } from '../../components/layout/app-shell';
import { Check, Edit2, Shield, Calendar, Mail, User } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export default function ProfilePage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [name, setName] = useState('');
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/sign-in');
    } else if (user) {
      setName(user.name);
      fetch(`${API_BASE_URL}/rooms`, { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && Array.isArray(data.data)) {
            setRooms(data.data);
          }
        })
        .catch(() => {});
    }
  }, [user, isAuthLoading, router]);

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'DEV';

  const activeRoomsCount = useMemo(
    () => rooms.filter((r) => (r.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length,
    [rooms]
  );

  const totalCollaborators = useMemo(
    () => rooms.reduce((acc, r) => acc + (r.memberCount || 1), 0),
    [rooms]
  );

  const joinedDate = useMemo(() => {
    if (!user?.createdAt) return 'Active Account';
    try {
      return new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return 'Active Account';
    }
  }, [user?.createdAt]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <AppShell title="Profile" subtitle="Your account and activity">
      <main className="dashboard-content settings-content">
        <div className="profile-hero">
          <span className="profile-avatar">{initials}</span>
          <div>
            <div className="kicker">DEVELOPER PROFILE</div>
            <h1>{user?.name || 'Developer'}</h1>
            <p>Full-Stack Software Engineer · Active Workspace</p>
          </div>
          <button
            className="app-button secondary"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Cancel' : 'Edit profile'}
          </button>
        </div>

        {isEditing && (
          <div className="panel" style={{ marginBottom: '20px', padding: '20px' }}>
            <form onSubmit={handleSave}>
              <label style={{ display: 'block', marginBottom: '16px' }}>
                <span style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 500 }}>
                  Full Name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                    background: 'var(--bg-main, #0b0f19)',
                    color: 'inherit',
                  }}
                  required
                />
              </label>
              <button type="submit" className="app-button">
                Save Changes
              </button>
            </form>
          </div>
        )}

        {savedSuccess && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#22c55e',
              fontSize: '13px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Check size={16} /> Profile updated successfully.
          </div>
        )}

        <div className="profile-grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Account details</h2>
                <p>Information about your CodeSync account</p>
              </div>
            </div>
            <div className="detail-list">
              <span>
                Full name
                <strong>{user?.name || 'Developer'}</strong>
              </span>
              <span>
                Email address
                <strong>{user?.email || 'user@codesync.ai'}</strong>
              </span>
              <span>
                Role
                <strong style={{ textTransform: 'capitalize' }}>
                  {user?.role?.toLowerCase() || 'Standard Developer'}
                </strong>
              </span>
              <span>
                Joined CodeSync
                <strong>{joinedDate}</strong>
              </span>
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <h2>Coding statistics</h2>
                <p>Your activity at a glance</p>
              </div>
            </div>
            <div className="profile-stats">
              <strong>
                {rooms.length}
                <small>Rooms created</small>
              </strong>
              <strong>
                {activeRoomsCount}
                <small>Active sessions</small>
              </strong>
              <strong>
                {totalCollaborators}
                <small>Collaborators</small>
              </strong>
            </div>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
