import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class FirestoreErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Terjadi gangguan sinkronisasi data.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('KonvoiKu ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      let parsedSummary = this.state.errorMessage;
      try {
        const obj = JSON.parse(this.state.errorMessage);
        if (obj?.error) {
          parsedSummary = `Akses data ditolak atau gagal (${obj.operationType || 'sync'}): ${obj.error}`;
        }
      } catch {
        // Non-JSON error message
      }

      return (
        <div className="min-h-screen bg-[#F1F5FA] dark:bg-[#0A0F16] flex items-center justify-center p-6 text-[#0F172A] dark:text-[#F1F5F9]">
          <div className="max-w-md w-full rounded-[24px] bg-white dark:bg-[#131B26] border border-[#E2E8F0] dark:border-[#2D3A4F] p-6 shadow-xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FEE2E2] dark:bg-[#450A0A] text-[#DC2626] dark:text-[#F87171] flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold">Sinkronisasi Terhenti</h2>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8] leading-relaxed break-words">
                {parsedSummary}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Muat Ulang Aplikasi</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
