'use client';

import React from 'react';

interface CurrencyInputProps {
  /** Current value */
  value: number;
  /** Change handler */
  onChange: (value: number) => void;
  /** Input label */
  label: string;
  /** Optional helper text below the input */
  helperText?: string;
  /** Optional placeholder */
  placeholder?: string;
  /** Whether this is a highlighted/primary input */
  highlighted?: boolean;
}

/**
 * A currency input field with $ prefix formatting.
 * Used for entering dollar amounts like list price and budget.
 */
export function CurrencyInput({
  value,
  onChange,
  label,
  helperText,
  placeholder,
  highlighted = false,
}: CurrencyInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-3 text-slate-500">$</span>
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          placeholder={placeholder}
          className={`w-full p-3 pl-8 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors
            ${highlighted
              ? 'border-2 border-emerald-500 font-medium'
              : 'border-slate-300'
            }`}
        />
      </div>
      {helperText && (
        <p className="text-xs text-slate-500 mt-1">{helperText}</p>
      )}
    </div>
  );
}

export default CurrencyInput;
