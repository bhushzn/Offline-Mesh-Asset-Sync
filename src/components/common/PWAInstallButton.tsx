import React, { useEffect, useState } from 'react';
import { Download, CheckCircle } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

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
      <div className="hidden lg:flex items-center space-x-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
        <CheckCircle className="w-3.5 h-3.5" />
        <span>PWA INSTALLED</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleInstallClick}
      title="Install FIELDLINK PWA for 100% Offline Access"
      className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#ff5533]/15 hover:bg-[#ff5533]/25 text-[#ff5533] border border-[#ff5533]/30 transition-all font-mono text-[11px] font-semibold tracking-wide shadow-sm"
    >
      <Download className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">INSTALL PWA</span>
      <span className="sm:hidden">INSTALL</span>
    </button>
  );
};
