'use client';

import React from 'react';

interface SliderProps {
  /** Current value (0-100 for percentage, or custom range) */
  value: number;
  /** Change handler */
  onChange: (value: number) => void;
  /** Input label */
  label: string;
  /** Minimum value */
  min?: number;
  /** Maximum value */
  max?: number;
  /** Step increment */
  step?: number;
  /** Left label (e.g., "Conservative") */
  leftLabel?: string;
  /** Center label (optional) */
  centerLabel?: string;
  /** Right label (e.g., "Aggressive") */
  rightLabel?: string;
  /** Display the current value */
  showValue?: boolean;
  /** Format function for displayed value */
  formatValue?: (value: number) => string;
  /** Optional helper text */
  helperText?: string;
  /** Custom gradient class for the track */
  gradientClass?: string;
}

/**
 * A styled range slider with labels.
 * Used for inputs like risk tolerance, market heat, and desire level.
 */
export function Slider({
  value,
  onChange,
  label,
  min = 0,
  max = 100,
  step = 1,
  leftLabel,
  centerLabel,
  rightLabel,
  showValue = false,
  formatValue,
  helperText,
  gradientClass,
}: SliderProps) {
  const displayValue = formatValue ? formatValue(value) : value.toString();

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`w-full h-2 rounded-lg appearance-none cursor-pointer
          ${gradientClass || 'bg-slate-200'}
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-emerald-500
          [&::-webkit-slider-thumb]:shadow-md
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-white
          [&::-moz-range-thumb]:w-5
          [&::-moz-range-thumb]:h-5
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-emerald-500
          [&::-moz-range-thumb]:border-2
          [&::-moz-range-thumb]:border-white
          [&::-moz-range-thumb]:cursor-pointer`}
      />
      <div className="flex justify-between text-sm mt-1">
        {leftLabel && <span className="text-slate-600">{leftLabel}</span>}
        {showValue && (
          <span className="font-bold text-emerald-600">{displayValue}</span>
        )}
        {centerLabel && !showValue && (
          <span className="text-slate-600">{centerLabel}</span>
        )}
        {rightLabel && <span className="text-slate-600">{rightLabel}</span>}
      </div>
      {helperText && (
        <p className="text-xs text-slate-500 mt-2">{helperText}</p>
      )}
    </div>
  );
}

export default Slider;
