'use client';

import { useState, useEffect } from 'react';
import { settingsApi } from '@/lib/api-client';
import confetti from 'canvas-confetti';
import { Moon, Star } from 'lucide-react';

export function RamadanWelcomeModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const checkRamadan = async () => {
      try {
        const { enabled, start_date, end_date } = await settingsApi.getRamadanMode();
        
        if (enabled && start_date && end_date) {
            const today = new Date();
            const start = new Date(start_date);
            const end = new Date(end_date);
            
            today.setHours(0, 0, 0, 0);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);

            if (today >= start && today <= end) {
                const storageKey = `ramadan_seen_${start.getFullYear()}`;
                const hasSeen = localStorage.getItem(storageKey);
                if (!hasSeen) {
                    setShow(true);
                }
            }
        }
      } catch (error) {
        console.error('Failed to check Ramadan status', error);
      }
    };

    checkRamadan();
  }, []);

  useEffect(() => {
    if (show) {
        triggerFireworks();
        // Keep triggering fireworks every few seconds while open
        const interval = setInterval(triggerFireworks, 3000);
        return () => clearInterval(interval);
    }
  }, [show]);

  const triggerFireworks = () => {
    const duration = 2000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: ['#fbbf24', '#10b981'] });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: ['#fbbf24', '#10b981'] });
    }, 250);
  };

  const handleClose = () => {
    const year = new Date().getFullYear();
    localStorage.setItem(`ramadan_seen_${year}`, 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-amber-500/20 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
        <div className="absolute -top-10 -left-10 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-amber-500/50">
            <Moon className="w-10 h-10 text-amber-400 fill-amber-400/20" />
            <Star className="w-4 h-4 text-emerald-400 absolute top-5 right-5 animate-pulse" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-2 font-serif tracking-wide">
            Ramadan Kareem
          </h1>
          <p className="text-2xl text-amber-500 font-arabic mb-6 font-bold">
            رمضان كريم
          </p>
          
          <p className="text-slate-400 mb-8 leading-relaxed">
            Wishing you a blessed month filled with peace, harmony, and joy.
            <br />
            <span className="text-xs text-slate-500 mt-2 block">
                Schedule timings have been adjusted to 70-minute slots.
            </span>
          </p>

          <button
            onClick={handleClose}
            className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-900 font-bold rounded-xl transition-all shadow-lg hover:shadow-amber-500/25"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
