'use client';

import React from 'react';

interface StepIndicatorProps {
  /** Current step (1-indexed) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Optional click handler to navigate to a step */
  onStepClick?: (step: number) => void;
  /** Labels for each step (optional) */
  labels?: string[];
}

/**
 * A step progress indicator showing completion status.
 * Used at the top of the multi-step form wizard.
 */
export function StepIndicator({
  currentStep,
  totalSteps,
  onStepClick,
  labels,
}: StepIndicatorProps) {
  return (
    <div className="w-full">
      {/* Step circles */}
      <div className="flex justify-center gap-2 mb-2">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
          const isCompleted = currentStep > step;
          const isCurrent = currentStep === step;
          const isClickable = onStepClick && step < totalSteps;

          return (
            <button
              key={step}
              onClick={() => isClickable && onStepClick(step)}
              disabled={!isClickable}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all
                ${isCurrent
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : isCompleted
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }
                ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
              `}
            >
              {isCompleted ? '✓' : step}
            </button>
          );
        })}
      </div>

      {/* Step labels */}
      {labels && labels.length === totalSteps && (
        <div className="flex justify-center gap-2">
          {labels.map((label, i) => (
            <div
              key={i}
              className={`w-10 text-center text-xs truncate
                ${currentStep === i + 1
                  ? 'text-emerald-600 font-medium'
                  : 'text-slate-400'
                }`}
            >
              {/* Only show label for current step on mobile */}
              <span className="hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StepIndicator;
