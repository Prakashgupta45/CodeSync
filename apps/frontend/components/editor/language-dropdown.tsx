'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check, Code2 } from 'lucide-react';

export interface ProgrammingLanguage {
  id: string;
  name: string;
  extension: string;
  monacoLang: string;
}

export const PROGRAMMING_LANGUAGES: ProgrammingLanguage[] = [
  { id: 'c', name: 'C', extension: 'c', monacoLang: 'c' },
  { id: 'cpp', name: 'C++', extension: 'cpp', monacoLang: 'cpp' },
  { id: 'java', name: 'Java', extension: 'java', monacoLang: 'java' },
  { id: 'python', name: 'Python', extension: 'py', monacoLang: 'python' },
  { id: 'javascript', name: 'JavaScript', extension: 'js', monacoLang: 'javascript' },
  { id: 'typescript', name: 'TypeScript', extension: 'ts', monacoLang: 'typescript' },
  { id: 'go', name: 'Go', extension: 'go', monacoLang: 'go' },
  { id: 'rust', name: 'Rust', extension: 'rs', monacoLang: 'rust' },
  { id: 'csharp', name: 'C#', extension: 'cs', monacoLang: 'csharp' },
];

export function normalizeLanguageId(raw?: string): string {
  const l = (raw || '').toLowerCase().trim();
  if (l === 'c++') return 'cpp';
  if (l === 'c#') return 'csharp';
  if (l === 'golang') return 'go';
  if (l === 'rs') return 'rust';
  if (l === 'ts') return 'typescript';
  if (l === 'js') return 'javascript';
  if (l === 'py') return 'python';
  return l || 'typescript';
}

export function getLanguageDisplay(raw?: string): string {
  const norm = normalizeLanguageId(raw);
  const found = PROGRAMMING_LANGUAGES.find((lang) => lang.id === norm);
  return found ? found.name : raw || 'TypeScript';
}

interface LanguageDropdownProps {
  value: string;
  onChange: (language: string) => void;
  disabled?: boolean;
  theme?: 'dark' | 'light';
}

export const LanguageDropdown: React.FC<LanguageDropdownProps> = ({
  value,
  onChange,
  disabled = false,
  theme = 'dark',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const normalizedValue = normalizeLanguageId(value);
  const currentLang = PROGRAMMING_LANGUAGES.find((l) => l.id === normalizedValue) || {
    id: normalizedValue,
    name: getLanguageDisplay(value),
    extension: 'txt',
    monacoLang: 'plaintext',
  };

  const handleSelect = useCallback(
    (langId: string) => {
      if (disabled) return;
      onChange(langId);
      setIsOpen(false);
    },
    [disabled, onChange]
  );

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isLight = theme === 'light';

  const triggerBg = isLight ? '#ffffff' : '#1e222b';
  const triggerBorder = isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.18)';
  const triggerColor = isLight ? '#0f172a' : '#f8fafc';

  const menuBg = isLight ? '#ffffff' : '#1a1d24';
  const menuBorder = isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.18)';
  const menuShadow = isLight
    ? '0 12px 28px rgba(0, 0, 0, 0.14), 0 4px 10px rgba(0, 0, 0, 0.06)'
    : '0 14px 35px rgba(0, 0, 0, 0.7), 0 4px 12px rgba(0, 0, 0, 0.45)';

  return (
    <div
      ref={dropdownRef}
      className="ide-language-dropdown-container"
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', zIndex: 100 }}
      data-testid="language-dropdown-container"
    >
      <button
        type="button"
        className="ide-language-dropdown-trigger"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Programming Language: ${currentLang.name}`}
        data-testid="language-dropdown-trigger"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          fontSize: '11px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontWeight: 600,
          borderRadius: '5px',
          border: triggerBorder,
          background: triggerBg,
          color: triggerColor,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.15s ease',
          height: '28px',
          boxShadow: isLight ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none',
        }}
      >
        <Code2 size={13} style={{ color: '#ff5c00', flexShrink: 0 }} />
        <span style={{ color: triggerColor, fontWeight: 700 }}>{currentLang.name}</span>
        <ChevronDown
          size={12}
          style={{
            color: isLight ? '#64748b' : '#94a3b8',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
            flexShrink: 0,
          }}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Select Programming Language"
          className="ide-language-dropdown-menu"
          data-testid="language-dropdown-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: '165px',
            background: menuBg,
            border: menuBorder,
            borderRadius: '7px',
            padding: '5px',
            boxShadow: menuShadow,
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {PROGRAMMING_LANGUAGES.map((lang) => {
            const isSelected = lang.id === normalizedValue;

            const itemColor = isSelected
              ? isLight
                ? '#ea580c'
                : '#ff7a29'
              : isLight
              ? '#1e293b'
              : '#e2e8f0';

            const itemBg = isSelected
              ? isLight
                ? 'rgba(255, 92, 0, 0.12)'
                : 'rgba(255, 92, 0, 0.22)'
              : 'transparent';

            const hoverBg = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.12)';
            const hoverColor = isLight ? '#0f172a' : '#ffffff';

            return (
              <button
                key={lang.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-testid={`language-option-${lang.id}`}
                onClick={() => handleSelect(lang.id)}
                className="ide-language-option"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  fontSize: '12px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontWeight: isSelected ? 700 : 500,
                  borderRadius: '5px',
                  border: 'none',
                  background: itemBg,
                  color: itemColor,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.12s ease, color 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = hoverBg;
                    e.currentTarget.style.color = hoverColor;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = itemColor;
                  }
                }}
              >
                <span style={{ color: 'inherit', fontWeight: isSelected ? 700 : 500 }}>
                  {lang.name}
                </span>
                {isSelected && (
                  <Check
                    size={13}
                    color={isLight ? '#ea580c' : '#ff5c00'}
                    style={{ strokeWidth: 2.5, flexShrink: 0 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
