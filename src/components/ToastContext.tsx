import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import './Toast.css';

type ToastAction = { label: string; value?: any };
type Toast = { id: string; message: string; type?: 'info' | 'success' | 'error'; duration?: number; actions?: ToastAction[] };

type ToastContextValue = {
  addToast: (t: Omit<Toast, 'id'>) => Promise<any>;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const handlersRef = useRef(new Map<string, (v: any) => void>());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = crypto?.randomUUID?.() ?? String(Date.now());
    setToasts(s => [...s, { id, ...t }]);
    return new Promise<any>((resolve) => {
      handlersRef.current.set(id, (v: any) => {
        resolve(v);
        handlersRef.current.delete(id);
        setToasts(s => s.filter(x => x.id !== id));
      });
      if (t.duration && t.duration > 0) {
        setTimeout(() => {
          const h = handlersRef.current.get(id);
          if (h) h(undefined);
        }, t.duration);
      }
    });
  }, []);

  const remove = useCallback((id: string) => setToasts((s) => s.filter(x => x.id !== id)), []);

  useEffect(() => {
    toasts.forEach(t => {
      if (!t.duration) return;
      const timer = setTimeout(() => remove(t.id), t.duration);
      return () => clearTimeout(timer);
    });
  }, [toasts, remove]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-portal">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type ?? 'info'}`}>
            <div className="toast-message">{t.message}</div>

            <div className="toast-actions">
              {t.actions?.map(a => (
                <button key={a.label} onClick={() => handlersRef.current.get(t.id)?.(a.value)}>
                  {a.label}
                </button>
              ))}
              <button onClick={() => handlersRef.current.get(t.id)?.(undefined)}>×</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};