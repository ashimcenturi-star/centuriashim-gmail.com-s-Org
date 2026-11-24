import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Award, Flame, Gift, Search } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DEFAULT_LOYALTY_SETTINGS } from '../data/defaultMenu';
import {
  LoyaltyPublicProgress,
  LoyaltySettings,
  VALIDATION_LIMITS,
} from '../types';
import { hashPhoneKey, normalizePhoneKey } from '../utils/phone';

interface CustomerLoyaltyPanelProps {
  initialWhatsapp?: string;
}

export function CustomerLoyaltyPanel({
  initialWhatsapp = '',
}: CustomerLoyaltyPanelProps) {
  const [phoneInput, setPhoneInput] = useState(initialWhatsapp);
  const [activeHash, setActiveHash] = useState<string | null>(null);
  const [checkedPhoneLabel, setCheckedPhoneLabel] = useState('');
  const [settings, setSettings] = useState<LoyaltySettings>(
    DEFAULT_LOYALTY_SETTINGS
  );
  const [progress, setProgress] = useState<LoyaltyPublicProgress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [lookupError, setLookupError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'loyalty'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as LoyaltySettings;
          setSettings({
            requiredStamps:
              data.requiredStamps || DEFAULT_LOYALTY_SETTINGS.requiredStamps,
            rewardDescription:
              data.rewardDescription ||
              DEFAULT_LOYALTY_SETTINGS.rewardDescription,
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/loyalty');
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!initialWhatsapp) return;
    const key = normalizePhoneKey(initialWhatsapp);
    if (VALIDATION_LIMITS.PHONE_KEY_REGEX.test(key)) {
      setPhoneInput(initialWhatsapp);
      setCheckedPhoneLabel(initialWhatsapp);
      hashPhoneKey(key).then((h) => setActiveHash(h));
    }
  }, [initialWhatsapp]);

  useEffect(() => {
    if (!activeHash) return;
    setLoadingProgress(true);
    const unsub = onSnapshot(
      doc(db, 'loyalty_public', activeHash),
      (snap) => {
        if (snap.exists()) {
          setProgress(snap.data() as LoyaltyPublicProgress);
        } else {
          setProgress({
            stampsCount: 0,
            totalStampsEarned: 0,
            rewardsRedeemed: 0,
          });
        }
        setLoadingProgress(false);
      },
      (error) => {
        setLoadingProgress(false);
        handleFirestoreError(
          error,
          OperationType.GET,
          `loyalty_public/${activeHash}`
        );
      }
    );
    return () => unsub();
  }, [activeHash]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError('');
    const key = normalizePhoneKey(phoneInput);
    if (!VALIDATION_LIMITS.PHONE_KEY_REGEX.test(key)) {
      setLookupError(
        'Enter a valid WhatsApp number (7–15 digits, e.g. 9841234567).'
      );
      return;
    }
    setCheckedPhoneLabel(phoneInput.trim());
    const h = await hashPhoneKey(key);
    setActiveHash(h);
  };

  const required = Math.max(1, settings.requiredStamps);
  const currentStamps = progress?.stampsCount ?? 0;
  const clampedDisplay = Math.min(required, currentStamps);
  const pct = Math.min(100, Math.round((currentStamps / required) * 100));
  const remaining = Math.max(0, required - currentStamps);

  return (
    <section
      id="loyalty"
      className="bg-white border border-[#EAE0D3] rounded-2xl p-5 sm:p-6 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F1E8DC]">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#D95D1E]">
            <Award className="w-4 h-4" />
            <span>Modern Bhatti Loyalty Card</span>
          </div>
          <h2 className="mt-1 font-display text-lg font-bold text-[#1A1715]">
            Collect {required} stamps · {settings.rewardDescription}
          </h2>
        </div>

        <form onSubmit={handleLookup} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8C7E72] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="WhatsApp number..."
              aria-label="Check loyalty stamps by WhatsApp number"
              className="w-44 sm:w-52 min-h-[42px] pl-9 pr-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
            />
          </div>
          <button
            type="submit"
            className="min-h-[42px] px-4 py-2 bg-[#1A1715] text-[#FAF6F0] text-xs font-semibold rounded-xl hover:bg-[#2F2A26] transition-colors cursor-pointer whitespace-nowrap"
          >
            Check Stamps
          </button>
        </form>
      </div>

      {lookupError && (
        <p className="mt-3 text-xs text-[#B91C1C] font-medium">{lookupError}</p>
      )}

      {!activeHash ? (
        <p className="mt-4 text-sm text-[#6B5F55]">
          Enter your WhatsApp number above (or place an order) to view your
          earned stamps and reward progress.
        </p>
      ) : loadingProgress ? (
        <p className="mt-4 text-sm text-[#6B5F55]">Loading your stamp card...</p>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-[#6B5F55]">
              WhatsApp:{' '}
              <span className="font-mono-tabular font-semibold text-[#1A1715]">
                {checkedPhoneLabel}
              </span>
              <span aria-hidden="true" className="mx-2">
                ·
              </span>
              <span>
                Rewards claimed:{' '}
                <strong className="font-mono-tabular text-[#1A1715]">
                  {progress?.rewardsRedeemed ?? 0}
                </strong>
              </span>
            </div>

            <div className="text-sm font-bold font-mono-tabular text-[#1A1715]">
              {currentStamps} / {required} stamps
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-[#F1E8DC] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#D95D1E] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Stamp Grid */}
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 pt-1">
            {Array.from({ length: required }, (_, idx) => {
              const earned = idx < clampedDisplay;
              return (
                <div
                  key={idx}
                  className={`aspect-square rounded-xl flex items-center justify-center border text-xs font-mono-tabular transition-colors ${
                    earned
                      ? 'bg-[#D95D1E] border-[#C24D12] text-white shadow-sm'
                      : 'bg-[#FAF6F0] border-dashed border-[#D8CBB9] text-[#9B8E82]'
                  }`}
                >
                  {earned ? (
                    <Flame className="w-4 h-4" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex items-center gap-2 text-xs sm:text-sm">
            <Gift
              className={`w-4 h-4 shrink-0 ${
                remaining === 0 ? 'text-[#D95D1E]' : 'text-[#8C7E72]'
              }`}
            />
            {remaining === 0 ? (
              <span className="font-semibold text-[#D95D1E]">
                Reward unlocked! Ask our Modern Bhatti staff to redeem:{' '}
                {settings.rewardDescription}.
              </span>
            ) : (
              <span className="text-[#5C5147]">
                Collect <strong className="font-mono-tabular">{remaining}</strong>{' '}
                more {remaining === 1 ? 'stamp' : 'stamps'} to unlock:{' '}
                <strong className="text-[#1A1715]">
                  {settings.rewardDescription}
                </strong>
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
