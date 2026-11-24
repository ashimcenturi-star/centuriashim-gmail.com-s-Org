import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { ArrowRight, QrCode, ShieldCheck, Utensils } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from './firebase';
import { RestaurantTable } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CustomerOrderView } from './components/CustomerOrderView';
import { AdminDashboard } from './components/AdminDashboard';

type AppPage = 'landing' | 'menu' | 'admin';

interface RouteState {
  page: AppPage;
  table: string;
}

function readRouteState(): RouteState {
  if (typeof window === 'undefined') {
    return { page: 'landing', table: '' };
  }
  const params = new URLSearchParams(window.location.search);
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const tableParam = (params.get('table') || '').trim();
  const viewParam = params.get('view');

  if (path === '/admin' || path.startsWith('/admin/') || viewParam === 'admin') {
    return { page: 'admin', table: '' };
  }

  if (path === '/menu' || tableParam) {
    return { page: 'menu', table: tableParam };
  }

  return { page: 'landing', table: '' };
}

function PortalLanding({
  onOpenTable,
  onOpenAdmin,
}: {
  onOpenTable: (tableNumber: string) => void;
  onOpenAdmin: () => void;
}) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loadingTables, setLoadingTables] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'tables'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<RestaurantTable, 'id'>),
          }))
          .filter((t) => t.active && t.id === t.tableNumber)
          .sort((a, b) =>
            a.tableNumber.localeCompare(b.tableNumber, undefined, {
              numeric: true,
            })
          );
        setTables(list);
        setLoadingTables(false);
      },
      (error) => {
        setLoadingTables(false);
        handleFirestoreError(error, OperationType.LIST, 'tables');
      }
    );
    return () => unsub();
  }, []);

  const primaryTable = tables[0]?.tableNumber || '01';

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col">
      <header className="bg-[#1A1715] text-[#FAF6F0] px-4 sm:px-6 h-16 flex items-center justify-between">
        <span className="font-display text-lg font-bold tracking-tight">
          Modern Bhatti
        </span>
        <span className="text-xs text-[#D6C9B8]">Machhapokhari, Kathmandu</span>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col justify-center">
        <div className="text-center max-w-xl mx-auto">
          <p className="text-xs font-semibold text-[#D95D1E]">
            Modern Bhatti · QR Code Ordering System
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#1A1715]">
            Choose a View to Preview
          </h1>
          <p className="mt-2.5 text-sm text-[#6B5F55] leading-relaxed">
            In the restaurant, customers scan a table QR code to open{' '}
            <span className="font-mono-tabular text-[#1A1715]">
              /menu?table=01
            </span>{' '}
            directly. Use the table links below to preview customer ordering or
            open the staff admin dashboard.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer Ordering Preview Card */}
          <div className="bg-white border border-[#EAE0D3] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#FFF4EC] border border-[#F2C6A7] flex items-center justify-center text-[#D95D1E]">
                <Utensils className="w-5 h-5" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-[#1A1715]">
                Customer Ordering Page
              </h2>
              <p className="mt-1.5 text-sm text-[#6B5F55] leading-relaxed">
                Simulate scanning a table QR code. Opens the mobile-friendly
                menu with the table automatically selected.
              </p>

              <div className="mt-4">
                <p className="text-xs font-semibold text-[#5C5147] mb-2">
                  Select a table QR link to preview:
                </p>
                {loadingTables ? (
                  <p className="text-xs text-[#786B5E]">Loading tables...</p>
                ) : tables.length === 0 ? (
                  <p className="text-xs text-[#786B5E]">
                    No active tables yet. Sign in to Admin first to initialize
                    tables 01–08 and the menu.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tables.map((tbl) => (
                      <button
                        key={tbl.id}
                        type="button"
                        onClick={() => onOpenTable(tbl.tableNumber)}
                        className="min-h-[38px] px-3 py-1.5 bg-[#FAF6F0] border border-[#E2D6C5] hover:border-[#D95D1E] hover:bg-[#FFF4EC] text-[#1A1715] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        Table {tbl.tableNumber}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenTable(primaryTable)}
              className="mt-6 w-full min-h-[46px] px-4 py-2.5 bg-[#D95D1E] text-white text-sm font-semibold rounded-xl hover:bg-[#C24D12] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              Preview Customer Menu (Table {primaryTable})
            </button>
          </div>

          {/* Admin Dashboard Card */}
          <div className="bg-white border border-[#EAE0D3] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-11 h-11 rounded-xl bg-[#FAF6F0] border border-[#E2D6C5] flex items-center justify-center text-[#1A1715]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-[#1A1715]">
                Admin Dashboard (/admin)
              </h2>
              <p className="mt-1.5 text-sm text-[#6B5F55] leading-relaxed">
                Manage incoming orders in real time, award loyalty stamps,
                update menu items & prices, and download or print table QR codes.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenAdmin}
              className="mt-6 w-full min-h-[46px] px-4 py-2.5 bg-[#1A1715] text-[#FAF6F0] text-sm font-semibold rounded-xl hover:bg-[#2F2A26] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open Admin Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<RouteState>(readRouteState);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(readRouteState());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (
      route.page === 'menu' &&
      route.table &&
      window.location.pathname !== '/menu'
    ) {
      window.history.replaceState(
        {},
        '',
        `/menu?table=${encodeURIComponent(route.table)}`
      );
    }
  }, [route.page, route.table]);

  const navigateToMenu = (tableNumber?: string) => {
    const url = tableNumber
      ? `/menu?table=${encodeURIComponent(tableNumber)}`
      : '/';
    window.history.pushState({}, '', url);
    setRoute(
      tableNumber
        ? { page: 'menu', table: tableNumber }
        : { page: 'landing', table: '' }
    );
  };

  const navigateToAdmin = () => {
    window.history.pushState({}, '', '/admin');
    setRoute({ page: 'admin', table: '' });
  };

  return (
    <ErrorBoundary>
      {route.page === 'admin' ? (
        <AdminDashboard onBackToCustomer={navigateToMenu} />
      ) : route.page === 'menu' ? (
        <CustomerOrderView tableFromUrl={route.table} />
      ) : (
        <PortalLanding
          onOpenTable={(tbl) => navigateToMenu(tbl)}
          onOpenAdmin={navigateToAdmin}
        />
      )}
    </ErrorBoundary>
  );
}
