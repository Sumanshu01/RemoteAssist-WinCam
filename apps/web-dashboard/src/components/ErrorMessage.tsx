import React from "react";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ErrorSeverity = "error" | "warning" | "info";

interface ErrorMessageProps {
  title?: string;
  message: string;
  severity?: ErrorSeverity;
  onDismiss?: () => void;
  actionText?: string;
  onAction?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title,
  message,
  severity = "error",
  onDismiss,
  actionText,
  onAction
}) => {
  const styles = {
    error: {
      container: "bg-rose-50 border-rose-200 text-rose-900",
      icon: <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />,
      actionBtn: "text-rose-700 hover:text-rose-900 underline font-semibold"
    },
    warning: {
      container: "bg-amber-50 border-amber-200 text-amber-900",
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />,
      actionBtn: "text-amber-800 hover:text-amber-950 underline font-semibold"
    },
    info: {
      container: "bg-blue-50 border-blue-200 text-blue-900",
      icon: <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />,
      actionBtn: "text-blue-700 hover:text-blue-900 underline font-semibold"
    }
  }[severity];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`border rounded-xl p-4 transition-all duration-200 flex items-start justify-between gap-3 shadow-sm ${styles.container}`}
    >
      <div className="flex items-start gap-3">
        {styles.icon}
        <div>
          {title && <h4 className="text-sm font-semibold mb-0.5">{title}</h4>}
          <p className="text-sm leading-relaxed">{message}</p>
          {actionText && onAction && (
            <button
              onClick={onAction}
              className={`mt-2 text-xs inline-block transition-colors ${styles.actionBtn}`}
            >
              {actionText}
            </button>
          )}
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="p-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
