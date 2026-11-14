'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/auth-context';
import { AppShell } from '../../components/layout/app-shell';
import { Check } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'editor' | 'notifications' | 'privacy'>('appearance');
  const [themePreference, setThemePreference] = useState<'dark' | 'light' | 'system'>('dark');
  const [defaultLanguage, setDefaultLanguage] = useState<'TypeScript' | 'JavaScript' | 'Python'>('TypeScript');
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/sign-in');
    }
    const saved = (localStorage.getItem('codesync-theme') as 'dark' | 'light') || 'dark';
    setThemePreference(saved);
  }, [user, isAuthLoading, router]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (themePreference !== 'system') {
      localStorage.setItem('codesync-theme', themePreference);
      document.documentElement.setAttribute('data-theme', themePreference);
      if (themePreference === 'light') {
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
      }
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <AppShell title="Settings" subtitle="Manage your workspace preferences">
      <main className="dashboard-content settings-content">
        <div className="page-heading">
          <div>
            <div className="kicker">WORKSPACE CONFIGURATION</div>
            <h1>Settings</h1>
            <p>Make CodeSync work the way you do.</p>
          </div>
        </div>

        <div className="settings-layout">
          <div className="settings-nav">
            <button
              className={activeTab === 'profile' ? 'active' : ''}
              onClick={() => setActiveTab('profile')}
            >
              Profile settings
            </button>
            <button
              className={activeTab === 'appearance' ? 'active' : ''}
              onClick={() => setActiveTab('appearance')}
            >
              Appearance
            </button>
            <button
              className={activeTab === 'editor' ? 'active' : ''}
              onClick={() => setActiveTab('editor')}
            >
              Editor preferences
            </button>
            <button
              className={activeTab === 'notifications' ? 'active' : ''}
              onClick={() => setActiveTab('notifications')}
            >
              Notifications
            </button>
            <button
              className={activeTab === 'privacy' ? 'active' : ''}
              onClick={() => setActiveTab('privacy')}
            >
              Privacy & security
            </button>
          </div>

          <form className="panel settings-panel" onSubmit={handleSave}>
            <h2>
              {activeTab === 'appearance' && 'Appearance'}
              {activeTab === 'profile' && 'Profile Settings'}
              {activeTab === 'editor' && 'Editor Preferences'}
              {activeTab === 'notifications' && 'Notification Settings'}
              {activeTab === 'privacy' && 'Privacy & Security'}
            </h2>
            <p>
              {activeTab === 'appearance' && 'Choose how CodeSync looks and behaves on your devices.'}
              {activeTab === 'profile' && 'Update your display name, email, and public developer handle.'}
              {activeTab === 'editor' && 'Configure tab size, auto-formatting, and indentation rules.'}
              {activeTab === 'notifications' && 'Choose which real-time events trigger alerts.'}
              {activeTab === 'privacy' && 'Manage token session lifetimes and data retention.'}
            </p>

            {saveSuccess && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#22c55e',
                  fontSize: '13px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Check size={16} /> Preferences saved successfully.
              </div>
            )}

            <label className="setting-row">
              <span>
                <strong>Theme preference</strong>
                <small>Use the system theme or choose one manually.</small>
              </span>
              <select
                value={themePreference}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setThemePreference(e.target.value as typeof themePreference)
                }
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </label>

            <label className="setting-row">
              <span>
                <strong>Default language</strong>
                <small>Used when creating a new room.</small>
              </span>
              <select
                value={defaultLanguage}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setDefaultLanguage(e.target.value as typeof defaultLanguage)
                }
              >
                <option value="TypeScript">TypeScript</option>
                <option value="JavaScript">JavaScript</option>
                <option value="Python">Python</option>
              </select>
            </label>

            <label className="setting-row">
              <span>
                <strong>Desktop notifications</strong>
                <small>Get notified when collaborators join.</small>
              </span>
              <input
                type="checkbox"
                checked={desktopNotifications}
                onChange={(e) => setDesktopNotifications(e.target.checked)}
              />
            </label>

            <button type="submit" className="app-button" style={{ alignSelf: 'flex-start' }}>
              Save changes
            </button>
          </form>
        </div>
      </main>
    </AppShell>
  );
}
