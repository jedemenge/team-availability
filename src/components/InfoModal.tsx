import React, { useEffect } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useState } from 'react';

export function InfoModal() {
  const { isInfoOpen, setInfoOpen, language } = useStore();
  const [copied, setCopied] = useState(false);

  const tenantId = localStorage.getItem('tenantId');
  const clientId = localStorage.getItem('clientId');
  const shareableUrl = tenantId && clientId
    ? `https://guileless-begonia-7f1e00.netlify.app/?tenantId=${tenantId}&clientId=${clientId}`
    : null;

  const handleCopy = async () => {
    if (shareableUrl) {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setInfoOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [setInfoOpen]);

  if (!isInfoOpen) return null;

  const texts = {
    'en-US': {
      title: 'About Team Availability',
      createdWith: 'Created with',
      createdBy: 'Created by',
      iconAttribution: 'Icon Attribution', 
      shareUrl: 'Share URL',
      shareUrlDescription: 'Share this URL with colleagues so they can configure their own team availability calendar:',
      copyToClipboard: 'Copy to clipboard',
      copied: 'Copied!',
    },
    'nl-NL': {
      title: 'Over Team-beschikbaarheid',
      createdWith: 'Gemaakt met',
      createdBy: 'Gemaakt door',
      iconAttribution: 'Icoon Attributie',
      shareUrl: 'Deel URL',
      shareUrlDescription: 'Deel deze URL met collega\'s zodat zij hun eigen team-beschikbaarheidskalender kunnen configureren:',
      copyToClipboard: 'Kopieer naar klembord',
      copied: 'Gekopieerd!',
    }
  };

  const t = texts[language];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">{t.title}</h2>
          <button
            onClick={() => setInfoOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <h3 className="font-medium mb-2">{t.createdWith}</h3>
            <p className="text-gray-600">
              <a 
                href="https://bolt.new" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                bolt.new
              </a>
            </p>
          </div>

          <div>
            <h3 className="font-medium mb-2">{t.createdBy}</h3>
            <div className="flex items-center gap-3">
              <p className="text-gray-600">Michel Claassen</p>
              <a
                href="https://github.com/jedemenge/team-availability"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-gray-800"
                title={language === 'nl-NL' ? 'Bekijk broncode op GitHub' : 'View source code on GitHub'}
              >
                <svg height="20" viewBox="0 0 24 24" className="fill-current">
                  <path d="M12.5.75C6.146.75 1 5.896 1 12.25c0 5.089 3.292 9.387 7.863 10.91.575.101.79-.244.79-.546 0-.273-.014-1.178-.014-2.142-2.889.532-3.636-.704-3.866-1.35-.13-.331-.69-1.352-1.18-1.625-.402-.216-.977-.748-.014-.762.906-.014 1.553.834 1.769 1.179 1.035 1.74 2.688 1.25 3.349.948.1-.747.402-1.25.733-1.538-2.559-.287-5.232-1.279-5.232-5.678 0-1.25.445-2.285 1.178-3.09-.115-.288-.517-1.467.115-3.048 0 0 .963-.302 3.163 1.179.92-.259 1.897-.388 2.875-.388.977 0 1.955.13 2.875.388 2.2-1.495 3.162-1.179 3.162-1.179.633 1.581.23 2.76.115 3.048.733.805 1.179 1.825 1.179 3.09 0 4.413-2.688 5.39-5.247 5.678.417.36.776 1.05.776 2.128 0 1.538-.014 2.774-.014 3.162 0 .302.216.662.79.547C20.709 21.637 24 17.324 24 12.25 24 5.896 18.854.75 12.5.75Z" />
                </svg>
              </a>
            </div>
          </div>
          
          <div>
            {shareableUrl && (
              <>
                <h3 className="font-medium mb-2">{t.shareUrl}</h3>
                <p className="text-sm text-gray-600 mb-2">
                  {t.shareUrlDescription}
                </p>
                <div className="relative">
                  <code className="block p-3 pr-12 bg-gray-50 rounded-lg text-sm font-mono break-all">
                    {shareableUrl}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
                    title={t.copyToClipboard}
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          <div>
            <h3 className="font-medium mb-2">{t.iconAttribution}</h3>
            <p className="text-sm text-gray-600">
              <a 
                href="https://www.flaticon.com/free-icons/sand-clock" 
                title="sand clock icons"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                Sand clock icons created by BomSymbols - Flaticon
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}