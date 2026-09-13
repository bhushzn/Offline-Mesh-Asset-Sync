import React, { useEffect, useState } from 'react';
import { Download, CheckCircle } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
  });

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert('PWA installation is supported directly in your browser menu (e.g. Chrome/Brave/Edge: click the Install icon in the address bar, iOS Safari: Share -> Add to Home Screen).');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  if (isInstalled) {
    return (
      <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-mono font-medium">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
        <span>PWA Installed</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleInstallClick}
      title="Install FIELDLINK PWA for 100% Offline Access"
      className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-all font-mono text-[11px] font-semibold tracking-wide shadow-2xs"
    >
      <Download className="w-3.5 h-3.5 text-blue-600" />
      <span className="hidden sm:inline">PWA</span>
    </button>
  );
};
