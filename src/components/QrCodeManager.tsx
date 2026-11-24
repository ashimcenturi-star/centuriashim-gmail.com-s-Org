import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { Download, ExternalLink, Plus, Printer, Trash2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { RestaurantTable, VALIDATION_LIMITS } from '../types';

interface QrCodeManagerProps {
  tables: RestaurantTable[];
  onPreviewTable: (tableNumber: string) => void;
}

interface TableQrCardProps {
  table: RestaurantTable;
  qrUrl: string;
  onDelete: (id: string) => Promise<void>;
  onPreview: (tableNumber: string) => void;
  onPrintSingle: (table: RestaurantTable) => void;
}

function TableQrCard({
  table,
  qrUrl,
  onDelete,
  onPreview,
  onPrintSingle,
}: TableQrCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrUrl, {
      width: 480,
      margin: 2,
      color: {
        dark: '#1A1715',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('QR generation failed:', err);
      });
    return () => {
      active = false;
    };
  }, [qrUrl]);

  const handleDownloadPng = async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 840;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Warm cream card background
      ctx.fillStyle = '#FAF6F0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Charcoal top header bar
      ctx.fillStyle = '#1A1715';
      ctx.fillRect(0, 0, canvas.width, 148);

      // Grilled orange accent stripe
      ctx.fillStyle = '#D95D1E';
      ctx.fillRect(0, 148, canvas.width, 8);

      // Header text
      ctx.fillStyle = '#FAF6F0';
      ctx.textAlign = 'center';
      ctx.font = 'bold 34px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('MODERN BHATTI', canvas.width / 2, 76);

      ctx.fillStyle = '#D6C9B8';
      ctx.font = '500 18px "DM Sans", sans-serif';
      ctx.fillText('Machhapokhari, Kathmandu', canvas.width / 2, 112);

      // Table Number
      ctx.fillStyle = '#1A1715';
      ctx.font = 'bold 44px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`TABLE ${table.tableNumber}`, canvas.width / 2, 224);

      if (table.label) {
        ctx.fillStyle = '#6B5F55';
        ctx.font = '500 18px "DM Sans", sans-serif';
        ctx.fillText(table.label, canvas.width / 2, 256);
      }

      // White QR container
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(104, 282, 432, 432);
      ctx.strokeStyle = '#E2D6C5';
      ctx.lineWidth = 3;
      ctx.strokeRect(104, 282, 432, 432);

      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, qrUrl, {
        width: 400,
        margin: 1,
        color: { dark: '#1A1715', light: '#FFFFFF' },
        errorCorrectionLevel: 'M',
      });
      ctx.drawImage(qrCanvas, 120, 298, 400, 400);

      // Footer instruction
      ctx.fillStyle = '#D95D1E';
      ctx.font = 'bold 22px "DM Sans", sans-serif';
      ctx.fillText('Scan to View Menu & Order', canvas.width / 2, 766);

      ctx.fillStyle = '#5C5147';
      ctx.font = '400 16px "DM Sans", sans-serif';
      ctx.fillText('Order directly from your table', canvas.width / 2, 798);

      const link = document.createElement('a');
      link.download = `modern-bhatti-table-${table.tableNumber.toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to download QR PNG:', err);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(table.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="qr-print-card bg-white border border-[#EAE0D3] rounded-2xl p-5 flex flex-col justify-between shadow-sm">
      <div className="text-center">
        <p className="text-xs font-medium text-[#D95D1E]">
          Modern Bhatti · Machhapokhari
        </p>
        <h3 className="mt-1 font-display text-xl font-bold text-[#1A1715]">
          Table {table.tableNumber}
        </h3>
        {table.label && (
          <p className="text-xs text-[#6B5F55] mt-0.5">{table.label}</p>
        )}

        <div className="mt-4 mx-auto w-44 h-44 bg-[#FAF6F0] border border-[#E6DACB] rounded-xl flex items-center justify-center p-2">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for Table ${table.tableNumber}`}
              className="w-full h-full object-contain rounded-lg"
            />
          ) : (
            <span className="text-xs text-[#786B5E]">Generating QR...</span>
          )}
        </div>

        <p className="mt-3 text-xs font-semibold text-[#1A1715]">
          Scan to view menu & order
        </p>
        <p className="mt-1 text-[11px] font-mono-tabular text-[#786B5E] truncate">
          {qrUrl}
        </p>
      </div>

      <div className="no-print mt-4 pt-4 border-t border-[#F1E8DC] flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDownloadPng}
            className="min-h-[40px] px-3 py-2 bg-[#1A1715] text-[#FAF6F0] text-xs font-medium rounded-xl hover:bg-[#2F2A26] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Download PNG
          </button>
          <button
            type="button"
            onClick={() => onPrintSingle(table)}
            className="min-h-[40px] px-3 py-2 bg-[#FAF6F0] border border-[#E2D6C5] text-[#1A1715] text-xs font-medium rounded-xl hover:bg-[#F1E8DC] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Card
          </button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onPreview(table.tableNumber)}
            className="min-h-[40px] px-3 py-2 text-xs font-semibold text-[#D95D1E] hover:bg-[#FAF6F0] rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Test Table Link
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="min-h-[36px] px-2.5 py-1 bg-[#B91C1C] text-white text-xs font-medium rounded-lg hover:bg-[#991B1B] cursor-pointer"
              >
                {deleting ? '...' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-[36px] px-2 py-1 text-xs text-[#6B5F55] hover:text-[#1A1715] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label={`Delete Table ${table.tableNumber}`}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#8C7E72] hover:text-[#B91C1C] hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function QrCodeManager({ tables, onPreviewTable }: QrCodeManagerProps) {
  const [tableNumber, setTableNumber] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [printFilterId, setPrintFilterId] = useState<string | null>(null);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';

  const buildTableUrl = (num: string) =>
    `${origin}/menu?table=${encodeURIComponent(num)}`;

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedNum = tableNumber.trim();
    const trimmedLabel = label.trim().slice(0, VALIDATION_LIMITS.TABLE_LABEL_MAX);

    if (!trimmedNum || trimmedNum.length > VALIDATION_LIMITS.TABLE_NUMBER_MAX) {
      setFormError(`Table number must be 1 to ${VALIDATION_LIMITS.TABLE_NUMBER_MAX} characters.`);
      return;
    }

    if (!VALIDATION_LIMITS.TABLE_NUMBER_REGEX.test(trimmedNum)) {
      setFormError('Use only letters, numbers, or hyphens with no spaces (e.g. 09 or VIP-1).');
      return;
    }

    if (
      tables.some(
        (t) => t.tableNumber.toLowerCase() === trimmedNum.toLowerCase()
      )
    ) {
      setFormError(`Table ${trimmedNum} already exists.`);
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, 'tables', trimmedNum), {
        tableNumber: trimmedNum,
        label: trimmedLabel,
        active: true,
        createdAt: serverTimestamp(),
      });
      setTableNumber('');
      setLabel('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `tables/${trimmedNum}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    try {
      await deleteDoc(doc(db, 'tables', tableId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tables/${tableId}`);
    }
  };

  const handlePrintAll = () => {
    setPrintFilterId(null);
    setTimeout(() => {
      window.print();
    }, 60);
  };

  const handlePrintSingle = (table: RestaurantTable) => {
    setPrintFilterId(table.id);
    setTimeout(() => {
      window.print();
      setPrintFilterId(null);
    }, 80);
  };

  const sortedTables = [...tables].sort((a, b) =>
    a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true })
  );

  const visibleForPrint = printFilterId
    ? sortedTables.filter((t) => t.id === printFilterId)
    : sortedTables;

  return (
    <div className="space-y-6">
      <div className="no-print bg-white border border-[#EAE0D3] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4 shadow-sm">
        <form
          onSubmit={handleAddTable}
          className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
        >
          <div>
            <label
              htmlFor="new-table-number"
              className="block text-xs font-medium text-[#5C5147] mb-1.5"
            >
              Table Number
            </label>
            <input
              id="new-table-number"
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              maxLength={VALIDATION_LIMITS.TABLE_NUMBER_MAX}
              placeholder="e.g. 09 or VIP-1"
              className="w-full min-h-[44px] px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
            />
          </div>
          <div>
            <label
              htmlFor="new-table-label"
              className="block text-xs font-medium text-[#5C5147] mb-1.5"
            >
              Seating Area (Optional)
            </label>
            <input
              id="new-table-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={VALIDATION_LIMITS.TABLE_LABEL_MAX}
              placeholder="e.g. Rooftop, Main Hall"
              className="w-full min-h-[44px] px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[44px] px-4 py-2 bg-[#D95D1E] text-white text-sm font-semibold rounded-xl hover:bg-[#C24D12] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {saving ? 'Adding...' : 'Add Table QR'}
            </button>
          </div>
        </form>

        <button
          type="button"
          onClick={handlePrintAll}
          disabled={sortedTables.length === 0}
          className="min-h-[44px] px-4 py-2 bg-[#1A1715] text-[#FAF6F0] text-sm font-medium rounded-xl hover:bg-[#2F2A26] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Printer className="w-4 h-4" />
          Print All QR Codes
        </button>
      </div>

      {formError && (
        <div className="no-print p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-[#B91C1C]">
          {formError}
        </div>
      )}

      {sortedTables.length === 0 ? (
        <div className="bg-white border border-[#EAE0D3] rounded-2xl p-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-[#1A1715]">
            No tables configured yet
          </p>
          <p className="mt-1 text-sm text-[#6B5F55]">
            Add your first table number above to generate a scannable QR code.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {visibleForPrint.map((table) => (
            <TableQrCard
              key={table.id}
              table={table}
              qrUrl={buildTableUrl(table.tableNumber)}
              onDelete={handleDeleteTable}
              onPreview={onPreviewTable}
              onPrintSingle={handlePrintSingle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
