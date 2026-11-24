import React, { useMemo, useState } from 'react';
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { Award, Check, Flame, Gift, Plus, Search, Settings } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  LoyaltyAccount,
  LoyaltyLedgerEntry,
  LoyaltySettings,
  VALIDATION_LIMITS,
} from '../types';
import { hashPhoneKey, normalizePhoneKey } from '../utils/phone';

interface LoyaltyManagerProps {
  adminEmail: string;
  settings: LoyaltySettings;
  accounts: LoyaltyAccount[];
  ledger: LoyaltyLedgerEntry[];
}

export function LoyaltyManager({
  adminEmail,
  settings,
  accounts,
  ledger,
}: LoyaltyManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Settings form
  const [reqStampsInput, setReqStampsInput] = useState(
    String(settings.requiredStamps)
  );
  const [rewardDescInput, setRewardDescInput] = useState(
    settings.rewardDescription
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState('');

  // Manual stamp award form
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualStamps, setManualStamps] = useState('1');
  const [manualNote, setManualNote] = useState('');
  const [manualError, setManualError] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const [busyAccountKey, setBusyAccountKey] = useState<string | null>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSavedMsg('');
    const numStamps = Math.floor(Number(reqStampsInput));
    const desc = rewardDescInput
      .trim()
      .slice(0, VALIDATION_LIMITS.REWARD_DESCRIPTION_MAX);

    if (
      Number.isNaN(numStamps) ||
      numStamps < VALIDATION_LIMITS.REQUIRED_STAMPS_MIN ||
      numStamps > VALIDATION_LIMITS.REQUIRED_STAMPS_MAX
    ) {
      return;
    }
    if (!desc) return;

    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'loyalty'), {
        requiredStamps: numStamps,
        rewardDescription: desc,
        updatedBy: adminEmail,
        updatedAt: serverTimestamp(),
      });
      setSettingsSavedMsg('Loyalty settings saved.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/loyalty');
    } finally {
      setSavingSettings(false);
    }
  };

  const applyManualStamps = async (
    rawPhone: string,
    customerName: string,
    delta: number,
    note: string
  ) => {
    const phoneKey = normalizePhoneKey(rawPhone);
    if (!VALIDATION_LIMITS.PHONE_KEY_REGEX.test(phoneKey)) {
      throw new Error('Invalid WhatsApp number.');
    }

    const phoneHash = await hashPhoneKey(phoneKey);
    const existingAccount = accounts.find((a) => a.phoneKey === phoneKey);
    const prevStamps = existingAccount?.stampsCount ?? 0;
    const prevLifetime = existingAccount?.totalStampsEarned ?? 0;
    const prevRedeemed = existingAccount?.rewardsRedeemed ?? 0;

    const nextStamps = Math.max(0, prevStamps + delta);
    const nextLifetime = delta > 0 ? prevLifetime + delta : prevLifetime;
    const nextRedeemed =
      delta < 0 ? prevRedeemed + 1 : prevRedeemed;

    const accountRef = doc(db, 'loyalty_accounts', phoneKey);
    const publicRef = doc(db, 'loyalty_public', phoneHash);
    const ledgerRef = doc(collection(db, 'loyalty_ledger'));

    const batch = writeBatch(db);
    if (existingAccount) {
      batch.update(accountRef, {
        customerName: customerName.trim().slice(0, VALIDATION_LIMITS.CUSTOMER_NAME_MAX) || existingAccount.customerName,
        whatsappNumber: rawPhone.trim().slice(0, VALIDATION_LIMITS.WHATSAPP_MAX),
        stampsCount: nextStamps,
        totalStampsEarned: nextLifetime,
        rewardsRedeemed: nextRedeemed,
        lastAwardedBy: adminEmail,
        lastAwardedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(accountRef, {
        phoneKey,
        phoneHash,
        whatsappNumber: rawPhone.trim().slice(0, VALIDATION_LIMITS.WHATSAPP_MAX),
        customerName:
          customerName.trim().slice(0, VALIDATION_LIMITS.CUSTOMER_NAME_MAX) ||
          'Customer',
        stampsCount: nextStamps,
        totalStampsEarned: nextLifetime,
        rewardsRedeemed: nextRedeemed,
        lastAwardedBy: adminEmail,
        lastAwardedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(publicRef, {
      stampsCount: nextStamps,
      totalStampsEarned: nextLifetime,
      rewardsRedeemed: nextRedeemed,
      updatedAt: serverTimestamp(),
    });

    batch.set(ledgerRef, {
      phoneKey,
      customerName:
        customerName.trim().slice(0, VALIDATION_LIMITS.CUSTOMER_NAME_MAX) ||
        existingAccount?.customerName ||
        'Customer',
      type: delta < 0 ? 'reward_redeem' : 'manual_add',
      delta,
      orderId: '',
      orderNumber: '',
      note: note.trim().slice(0, VALIDATION_LIMITS.LEDGER_NOTE_MAX) || (delta < 0 ? 'Reward redeemed' : 'Manual stamp added'),
      awardedBy: adminEmail,
      awardedAt: serverTimestamp(),
    });

    await batch.commit();
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');
    const phoneKey = normalizePhoneKey(manualPhone);
    const delta = Math.floor(Number(manualStamps));
    const cleanName = manualName.trim();

    if (!cleanName) {
      setManualError('Customer name is required.');
      return;
    }
    if (!VALIDATION_LIMITS.PHONE_KEY_REGEX.test(phoneKey)) {
      setManualError('Enter a valid WhatsApp number (7–15 digits).');
      return;
    }
    if (Number.isNaN(delta) || delta < 1 || delta > 20) {
      setManualError('Stamps to add must be between 1 and 20.');
      return;
    }

    setSavingManual(true);
    try {
      await applyManualStamps(
        manualPhone,
        cleanName,
        delta,
        manualNote || 'Manual counter stamp'
      );
      setManualName('');
      setManualPhone('');
      setManualStamps('1');
      setManualNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'loyalty_accounts');
    } finally {
      setSavingManual(false);
    }
  };

  const handleQuickAdd = async (acc: LoyaltyAccount) => {
    setBusyAccountKey(acc.phoneKey);
    try {
      await applyManualStamps(
        acc.whatsappNumber,
        acc.customerName,
        1,
        'Quick +1 stamp by staff'
      );
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `loyalty_accounts/${acc.phoneKey}`
      );
    } finally {
      setBusyAccountKey(null);
    }
  };

  const handleRedeemReward = async (acc: LoyaltyAccount) => {
    if (acc.stampsCount < settings.requiredStamps) return;
    setBusyAccountKey(acc.phoneKey);
    try {
      await applyManualStamps(
        acc.whatsappNumber,
        acc.customerName,
        -settings.requiredStamps,
        `Redeemed: ${settings.rewardDescription}`
      );
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `loyalty_accounts/${acc.phoneKey}`
      );
    } finally {
      setBusyAccountKey(null);
    }
  };

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sorted = [...accounts].sort(
      (a, b) =>
        (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
    );
    if (!q) return sorted;
    return sorted.filter(
      (a) =>
        a.customerName.toLowerCase().includes(q) ||
        a.whatsappNumber.toLowerCase().includes(q) ||
        a.phoneKey.includes(q)
    );
  }, [accounts, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Manual Stamp Award & Reward Configuration */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-[#EAE0D3] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#D95D1E]">
              <Flame className="w-4 h-4" />
              <span>Manual Stamp Award</span>
            </div>
            <h2 className="mt-1 font-display text-base font-bold text-[#1A1715]">
              Add Loyalty Stamps
            </h2>

            <form onSubmit={handleManualSubmit} className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="manual-cust-name"
                  className="block text-xs font-medium text-[#5C5147] mb-1"
                >
                  Customer Name *
                </label>
                <input
                  id="manual-cust-name"
                  type="text"
                  required
                  maxLength={VALIDATION_LIMITS.CUSTOMER_NAME_MAX}
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Suman Gurung"
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label
                    htmlFor="manual-cust-phone"
                    className="block text-xs font-medium text-[#5C5147] mb-1"
                  >
                    WhatsApp Number *
                  </label>
                  <input
                    id="manual-cust-phone"
                    type="tel"
                    required
                    maxLength={VALIDATION_LIMITS.WHATSAPP_MAX}
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="9841234567"
                    className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="manual-stamps-qty"
                    className="block text-xs font-medium text-[#5C5147] mb-1"
                  >
                    Stamps
                  </label>
                  <input
                    id="manual-stamps-qty"
                    type="number"
                    min={1}
                    max={20}
                    required
                    value={manualStamps}
                    onChange={(e) => setManualStamps(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl font-mono-tabular focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="manual-stamp-note"
                  className="block text-xs font-medium text-[#5C5147] mb-1"
                >
                  Note (Optional)
                </label>
                <input
                  id="manual-stamp-note"
                  type="text"
                  maxLength={VALIDATION_LIMITS.LEDGER_NOTE_MAX}
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="e.g. Counter visit bonus"
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
                />
              </div>

              {manualError && (
                <p className="text-xs text-[#B91C1C] font-medium">{manualError}</p>
              )}

              <button
                type="submit"
                disabled={savingManual}
                className="w-full min-h-[44px] px-4 py-2.5 bg-[#D95D1E] text-white text-sm font-semibold rounded-xl hover:bg-[#C24D12] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                {savingManual ? 'Awarding...' : 'Add Stamps'}
              </button>
            </form>
          </div>

          {/* Loyalty Reward Configuration */}
          <div className="bg-white border border-[#EAE0D3] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6B5F55]">
              <Settings className="w-4 h-4" />
              <span>Reward Configuration</span>
            </div>
            <h2 className="mt-1 font-display text-base font-bold text-[#1A1715]">
              Stamp Goal & Reward
            </h2>

            <form onSubmit={handleSaveSettings} className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="cfg-req-stamps"
                  className="block text-xs font-medium text-[#5C5147] mb-1"
                >
                  Required Stamps for Reward (1–50)
                </label>
                <input
                  id="cfg-req-stamps"
                  type="number"
                  min={VALIDATION_LIMITS.REQUIRED_STAMPS_MIN}
                  max={VALIDATION_LIMITS.REQUIRED_STAMPS_MAX}
                  required
                  value={reqStampsInput}
                  onChange={(e) => setReqStampsInput(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl font-mono-tabular focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
                />
              </div>

              <div>
                <label
                  htmlFor="cfg-reward-desc"
                  className="block text-xs font-medium text-[#5C5147] mb-1"
                >
                  Reward Description
                </label>
                <input
                  id="cfg-reward-desc"
                  type="text"
                  required
                  maxLength={VALIDATION_LIMITS.REWARD_DESCRIPTION_MAX}
                  value={rewardDescInput}
                  onChange={(e) => setRewardDescInput(e.target.value)}
                  placeholder="e.g. Free Chicken Dum Biryani"
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
                />
              </div>

              {settingsSavedMsg && (
                <p className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {settingsSavedMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full min-h-[44px] px-4 py-2.5 bg-[#1A1715] text-[#FAF6F0] text-sm font-medium rounded-xl hover:bg-[#2F2A26] disabled:opacity-50 cursor-pointer transition-colors"
              >
                {savingSettings ? 'Saving...' : 'Save Loyalty Rules'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Customer Loyalty Records & Audit History */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white border border-[#EAE0D3] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-[#F1E8DC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#1A1715]">
                  Customer Loyalty Accounts ({accounts.length})
                </h2>
                <p className="text-xs text-[#6B5F55]">
                  Goal: {settings.requiredStamps} stamps · {settings.rewardDescription}
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-[#8C7E72] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name or WhatsApp..."
                  className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
                />
              </div>
            </div>

            {filteredAccounts.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#6B5F55]">
                {accounts.length === 0
                  ? 'No loyalty accounts yet. Award a stamp from an order or add one manually.'
                  : 'No matching customer records found.'}
              </div>
            ) : (
              <div className="divide-y divide-[#F1E8DC]">
                {filteredAccounts.map((acc) => {
                  const pct = Math.min(
                    100,
                    Math.round((acc.stampsCount / settings.requiredStamps) * 100)
                  );
                  const canRedeem = acc.stampsCount >= settings.requiredStamps;
                  const lastTime = acc.lastAwardedAt?.toDate
                    ? acc.lastAwardedAt.toDate().toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Just now';

                  return (
                    <div
                      key={acc.phoneKey}
                      className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-[#1A1715]">
                            {acc.customerName}
                          </h3>
                          <span className="text-xs font-mono-tabular text-[#6B5F55]">
                            {acc.whatsappNumber}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex-1 max-w-xs h-2 bg-[#F1E8DC] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#D95D1E]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold font-mono-tabular text-[#1A1715]">
                            {acc.stampsCount} / {settings.requiredStamps} stamps
                          </span>
                        </div>

                        <p className="mt-1.5 text-[11px] text-[#786B5E]">
                          Lifetime: {acc.totalStampsEarned} · Redeemed:{' '}
                          {acc.rewardsRedeemed} · Last by {acc.lastAwardedBy} ({lastTime})
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busyAccountKey === acc.phoneKey}
                          onClick={() => handleQuickAdd(acc)}
                          className="min-h-[40px] px-3.5 py-2 bg-[#1A1715] text-[#FAF6F0] text-xs font-medium rounded-xl hover:bg-[#2F2A26] disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          +1 Stamp
                        </button>

                        {canRedeem && (
                          <button
                            type="button"
                            disabled={busyAccountKey === acc.phoneKey}
                            onClick={() => handleRedeemReward(acc)}
                            className="min-h-[40px] px-3.5 py-2 bg-[#D95D1E] text-white text-xs font-semibold rounded-xl hover:bg-[#C24D12] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Gift className="w-3.5 h-3.5" />
                            Redeem Reward
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Immutable Stamp Audit Log */}
          <div className="bg-white border border-[#EAE0D3] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-[#F1E8DC] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#D95D1E]" />
                <h2 className="font-display text-base font-bold text-[#1A1715]">
                  Stamp Award Audit Log
                </h2>
              </div>
              <span className="text-xs font-mono-tabular text-[#6B5F55]">
                {ledger.length} entries
              </span>
            </div>

            {ledger.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#6B5F55]">
                No stamp awards recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#F1E8DC] text-[#6B5F55] bg-[#FAF6F0]">
                      <th className="py-2.5 px-4 font-semibold">When</th>
                      <th className="py-2.5 px-4 font-semibold">Customer</th>
                      <th className="py-2.5 px-4 font-semibold">Stamps</th>
                      <th className="py-2.5 px-4 font-semibold">Reason / Order</th>
                      <th className="py-2.5 px-4 font-semibold">Awarded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1E8DC]">
                    {ledger.slice(0, 30).map((entry) => {
                      const whenStr = entry.awardedAt?.toDate
                        ? entry.awardedAt.toDate().toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Just now';

                      return (
                        <tr key={entry.id} className="hover:bg-[#FAF6F0]/60">
                          <td className="py-2.5 px-4 font-mono-tabular text-[#5C5147] whitespace-nowrap">
                            {whenStr}
                          </td>
                          <td className="py-2.5 px-4">
                            <span className="font-semibold text-[#1A1715]">
                              {entry.customerName}
                            </span>
                            <span className="block font-mono-tabular text-[11px] text-[#786B5E]">
                              {entry.phoneKey}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono-tabular font-bold whitespace-nowrap">
                            <span
                              className={
                                entry.delta > 0
                                  ? 'text-emerald-700'
                                  : 'text-[#D95D1E]'
                              }
                            >
                              {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-[#5C5147]">
                            {entry.orderNumber ? `${entry.orderNumber} · ` : ''}
                            {entry.note}
                          </td>
                          <td className="py-2.5 px-4 font-mono-tabular text-[#5C5147]">
                            {entry.awardedBy}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
