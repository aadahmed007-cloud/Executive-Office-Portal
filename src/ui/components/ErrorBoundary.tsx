import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by Executive ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetState = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
          <div className="max-w-md w-full bg-slate-900 border border-rose-900/60 rounded-3xl p-8 text-center shadow-2xl space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-950/80 border border-rose-600/40 flex items-center justify-center text-rose-400 shadow-lg">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-100">تنبيه في معالجة العرض التنفيذي</h2>
              <p className="text-xs text-rose-400 font-medium">الهيئة القومية للبريد المصري — مكتب رئيس مجلس الإدارة</p>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              حدث استثناء غير متوقع أثناء معالجة بيانات الشاشة الحالية. بياناتك المحلية المحفوظة في قاعدة بيانات SQLite آمنة تماماً.
            </p>

            {this.state.error && (
              <div className="text-[11px] font-mono text-slate-400 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-left truncate">
                {this.state.error.message}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={this.handleResetState}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                استئناف العمل
              </button>
              <button
                onClick={this.handleReload}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة تحميل</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
