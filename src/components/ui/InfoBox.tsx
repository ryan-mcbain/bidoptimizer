'use client';

import React from 'react';

type InfoBoxVariant = 'info' | 'warning' | 'success' | 'error';

interface InfoBoxProps {
  /** The variant/color scheme */
  variant?: InfoBoxVariant;
  /** Title (optional, shown in bold) */
  title?: string;
  /** Main content */
  children: React.ReactNode;
}

const variantStyles: Record<InfoBoxVariant, string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
};

/**
 * An informational box for displaying tips, warnings, or important notes.
 */
export function InfoBox({
  variant = 'info',
  title,
  children,
}: InfoBoxProps) {
  return (
    <div className={`p-3 rounded-lg border ${variantStyles[variant]}`}>
      {title && <strong>{title}</strong>}
      {title && ' '}
      <span className="text-sm">{children}</span>
    </div>
  );
}

export default InfoBox;
