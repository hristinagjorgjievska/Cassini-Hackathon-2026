"use client";

import { X, AlertCircle, Info, CheckCircle } from "lucide-react";

export type AlertType = "error" | "info" | "success" | "warning";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: AlertType;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function AlertModal({ isOpen, onClose, title, message, type = "info", onConfirm, confirmText = "Confirm", cancelText = "Cancel" }: AlertModalProps) {
  if (!isOpen) return null;

  const icons = {
    error: <AlertCircle className="h-6 w-6 text-red-500" />,
    warning: <AlertCircle className="h-6 w-6 text-amber-500" />,
    info: <Info className="h-6 w-6 text-blue-500" />,
    success: <CheckCircle className="h-6 w-6 text-emerald-500" />
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-slate-200 dark:ring-white/10">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {icons[type]}
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed text-sm font-medium">
            {message}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            {onConfirm ? cancelText : "Close"}
          </button>
          {onConfirm && (
            <button 
              onClick={() => { onConfirm(); onClose(); }} 
              className={`px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm transition-colors ${type === 'error' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#0277bd] hover:bg-[#01579b]'}`}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
