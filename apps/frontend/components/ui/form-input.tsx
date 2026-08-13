'use client';

import React, { useId } from 'react';
import { LucideIcon } from 'lucide-react';

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: LucideIcon;
  error?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  icon: Icon,
  error,
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled,
  required,
  id: customId,
  className = '',
  style,
  ...props
}) => {
  const generatedId = useId();
  const inputId = customId || generatedId;

  return (
    <div className="w-full">
      {/* Input Label */}
      <label
        htmlFor={inputId}
        className="block text-xs font-mono font-medium text-text-muted mb-1.5 uppercase tracking-wider"
      >
        {label}
        {required && <span className="text-replit-orange ml-1">*</span>}
      </label>

      {/* Input Relative Wrapper */}
      <div className="relative flex items-center group w-full">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 z-10 h-4 w-4 text-[#62687a] group-hover:text-[#9da2b0] group-focus-within:text-replit-orange transition-colors duration-150"
            aria-hidden="true"
          />
        )}

        <input
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          style={{
            paddingLeft: Icon ? '2.75rem' : '0.875rem',
            ...style,
          }}
          className={`
            w-full h-11 py-2.5 pr-3.5 text-text-main text-sm font-sans rounded-md
            bg-[#16181d] hover:bg-[#1a1d24]
            border border-border-subtle hover:border-[#404656]
            focus:border-replit-orange focus:bg-[#1c1e26] focus:outline-none focus:ring-2 focus:ring-replit-orange/20
            transition-all duration-150 ease-in-out
            placeholder:text-[#62687a]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${Icon ? 'pl-11' : 'px-3.5'}
            ${error ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20' : ''}
            ${className}
          `}
          {...props}
        />
      </div>

      {/* Error Message */}
      {error && (
        <p className="mt-1.5 text-xs text-red-400 font-mono" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
