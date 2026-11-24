import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Award,
  Bell,
  Check,
  Edit3,
  LogOut,
  Plus,
  QrCode,
  ShieldAlert,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_LOYALTY_SETTINGS,
  DEFAULT_MENU_ITEMS,
  DEFAULT_TABLES,
} from '../data/defaultMenu';
import {
  ADMIN_EMAIL,
  Category,
  LoyaltyAccount,
  LoyaltyLedgerEntry,
  LoyaltySettings,
  MenuItem,
  Order,
  ORDER_STATUS_LIST,
  OrderStatusValue,
  RestaurantTable,
  VALIDATION_LIMITS,
} from '../types';
import { hashPhoneKey, normalizePhoneKey } from '../utils/phone';
import { playNewOrderSound, unlockAudio } from '../utils/sound';
import { LoyaltyManager } from './LoyaltyManager';
import { QrCodeManager } from './QrCodeManager';

interface AdminDashboardProps {
  onBackToCustomer: (tableNumber?: string) => void;
}

type AdminTab = 'orders' | 'loyalty' | 'menu' | 'qrcodes';

const STATUS_STYLE: Record<string, string> = {
  New: 'text-amber-800 bg-amber-50 border-amber-200',
  Accepted: 'text-sky-800 bg-sky-50 border-sky-200',
  Preparing: 'text-[#C24D12] bg-orange-50 border-orange-200',
  Ready: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  Completed: 'text-[#5C5147] bg-[#F3ECE1] border-[#E2D6C5]',
  Cancelled: 'text-[#B91C1C] bg-red-50 border-red-200',
  Rejected: 'text-[#B91C1C] bg-red-50 border-red-200',
};

export function AdminDashboard({ onBackToCustomer }: AdminDashboardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [newOrderToast, setNewOrderToast] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);

  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings>(
    DEFAULT_LOYALTY_SETTINGS
  );
  const [loyaltyAccounts, setLoyaltyAccounts] = useState<LoyaltyAccount[]>([]);
  const [loyaltyLedger, setLoyaltyLedger] = useState<LoyaltyLedgerEntry[]>([]);

  const [orderFilter, setOrderFilter] = useState<OrderStatusValue | 'All'>('All');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [awardingOrderId, setAwardingOrderId] = useState<string | null>(null);

  // Menu Management state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [dishName, setDishName] = useState('');
  const [dishCategory, setDishCategory] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [dishDescription, setDishDescription] = useState('');
  const [dishImageUrl, setDishImageUrl] = useState('');
  const [dishAvailable, setDishAvailable] = useState(true);
  const [menuFormError, setMenuFormError] = useState('');
  const [savingDish, setSavingDish] = useState(false);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(
    null
  );

  const [newCategoryName, setNewCategoryName] = useState('');
  const [seedingDefaults, setSeedingDefaults] = useState(false);

  const initialOrdersLoadedRef = useRef(false);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const menuLoadedRef = useRef(false);
  const catsLoadedRef = useRef(false);
  const tablesLoadedRef = useRef(false);
  const autoSeedCheckedRef = useRef(false);
  const [snapshotsReady, setSnapshotsReady] = useState(false);

  const isAuthorizedAdmin =
    Boolean(user) &&
    Boolean(user?.emailVerified) &&
    user?.email === ADMIN_EMAIL;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAuthorizedAdmin) return;
    const handlePointerDown = () => {
      unlockAudio().then((ok) => {
        if (ok) setAudioUnlocked(true);
      });
    };
    window.addEventListener('pointerdown', handlePointerDown, { once: true });
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isAuthorizedAdmin]);

  useEffect(() => {
    if (!authReady || !isAuthorizedAdmin) return;

    const ordersQuery = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc')
    );

    const unsubOrders = onSnapshot(
      ordersQuery,
      (snap) => {
        const list: Order[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Order, 'id'>),
        }));

        if (initialOrdersLoadedRef.current) {
          let hasNewOrder = false;
          let latestOrderLabel = '';
          snap.docChanges().forEach((change) => {
            if (
              change.type === 'added' &&
              !knownOrderIdsRef.current.has(change.doc.id)
            ) {
              const data = change.doc.data() as Omit<Order, 'id'>;
              if (data.status === 'New') {
                hasNewOrder = true;
                latestOrderLabel = `${data.orderNumber} (Table ${data.tableNumber})`;
              }
            }
          });

          if (hasNewOrder) {
            setNewOrderToast(`New order received: ${latestOrderLabel}`);
            if (soundEnabled) {
              playNewOrderSound();
            }
          }
        } else {
          initialOrdersLoadedRef.current = true;
        }

        knownOrderIdsRef.current = new Set(list.map((o) => o.id));
        setOrders(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      }
    );

    const unsubMenu = onSnapshot(
      collection(db, 'menu_items'),
      (snap) => {
        const items = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<MenuItem, 'id'>),
          }))
          .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
        setMenuItems(items);
        menuLoadedRef.current = true;
        if (catsLoadedRef.current && tablesLoadedRef.current) {
          setSnapshotsReady(true);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'menu_items');
      }
    );

    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        const cats = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Category, 'id'>),
          }))
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setCategories(cats);
        catsLoadedRef.current = true;
        if (menuLoadedRef.current && tablesLoadedRef.current) {
          setSnapshotsReady(true);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'categories');
      }
    );

    const unsubTables = onSnapshot(
      collection(db, 'tables'),
      (snap) => {
        const tbls = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<RestaurantTable, 'id'>),
        }));
        setTables(tbls);
        tablesLoadedRef.current = true;
        if (menuLoadedRef.current && catsLoadedRef.current) {
          setSnapshotsReady(true);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'tables');
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'loyalty'),
      (snap) => {
        if (snap.exists()) {
          setLoyaltySettings(snap.data() as LoyaltySettings);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/loyalty');
      }
    );

    const unsubLoyaltyAccounts = onSnapshot(
      collection(db, 'loyalty_accounts'),
      (snap) => {
        const accs = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<LoyaltyAccount, 'id'>),
        }));
        setLoyaltyAccounts(accs);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'loyalty_accounts');
      }
    );

    const unsubLoyaltyLedger = onSnapshot(
      query(collection(db, 'loyalty_ledger'), orderBy('awardedAt', 'desc')),
      (snap) => {
        const entries = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<LoyaltyLedgerEntry, 'id'>),
        }));
        setLoyaltyLedger(entries);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'loyalty_ledger');
      }
    );

    return () => {
      unsubOrders();
      unsubMenu();
      unsubCategories();
      unsubTables();
      unsubSettings();
      unsubLoyaltyAccounts();
      unsubLoyaltyLedger();
    };
  }, [authReady, isAuthorizedAdmin, soundEnabled]);

  const seedDefaultRestaurantData = async (upgradeCategories = false) => {
    setSeedingDefaults(true);
    try {
      const batch = writeBatch(db);
      if (upgradeCategories || categories.length === 0) {
        DEFAULT_CATEGORIES.forEach((cat) => {
          batch.set(doc(db, 'categories', cat.id), {
            name: cat.name,
            sortOrder: cat.sortOrder,
            createdAt: serverTimestamp(),
          });
        });
      }
      if (upgradeCategories || menuItems.length === 0) {
        DEFAULT_MENU_ITEMS.forEach((item) => {
          batch.set(doc(db, 'menu_items', item.id), {
            name: item.name,
            description: item.description,
            price: item.price,
            category: item.category,
            available: item.available,
            sortOrder: item.sortOrder,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      }
      if (tables.length === 0) {
        DEFAULT_TABLES.forEach((tbl) => {
          batch.set(doc(db, 'tables', tbl.id), {
            tableNumber: tbl.tableNumber,
            label: tbl.label,
            active: tbl.active,
            createdAt: serverTimestamp(),
          });
        });
      }
      batch.set(doc(db, 'settings', 'loyalty'), {
        requiredStamps: DEFAULT_LOYALTY_SETTINGS.requiredStamps,
        rewardDescription: DEFAULT_LOYALTY_SETTINGS.rewardDescription,
        updatedBy: user?.email || ADMIN_EMAIL,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'menu_items');
    } finally {
      setSeedingDefaults(false);
    }
  };

  useEffect(() => {
    if (!isAuthorizedAdmin || !snapshotsReady || autoSeedCheckedRef.current) return;
    autoSeedCheckedRef.current = true;
    if (
      menuItems.length === 0 &&
      categories.length === 0 &&
      tables.length === 0
    ) {
      seedDefaultRestaurantData();
    }
  }, [
    isAuthorizedAdmin,
    snapshotsReady,
    menuItems.length,
    categories.length,
    tables.length,
  ]);

  useEffect(() => {
    if (!isAuthorizedAdmin || !snapshotsReady) return;
    const hasLegacyTables = tables.some((t) => t.id !== t.tableNumber);
    if (!hasLegacyTables) return;
    const migrateTables = async () => {
      try {
        const batch = writeBatch(db);
        tables.forEach((t) => {
          if (t.id !== t.tableNumber) {
            const padded = /^\d$/.test(t.tableNumber)
              ? t.tableNumber.padStart(2, '0')
              : t.tableNumber;
            batch.set(doc(db, 'tables', padded), {
              tableNumber: padded,
              label: t.label || '',
              active: t.active,
              createdAt: serverTimestamp(),
            });
            batch.delete(doc(db, 'tables', t.id));
          }
        });
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'tables');
      }
    };
    migrateTables();
  }, [isAuthorizedAdmin, snapshotsReady, tables]);

  const needsCategoryUpgrade = useMemo(() => {
    if (categories.length === 0) return false;
    const names = new Set(categories.map((c) => c.name));
    return DEFAULT_CATEGORIES.some((dc) => !names.has(dc.name));
  }, [categories]);

  const handleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Google sign-in failed.'
      );
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: OrderStatusValue
  ) => {
    setUpdatingOrderId(orderId);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'order_status', orderId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const ledgerOrderIds = useMemo(() => {
    const set = new Set<string>();
    loyaltyLedger.forEach((entry) => {
      if (entry.type === 'order_award' && entry.orderId) {
        set.add(entry.orderId);
      }
    });
    return set;
  }, [loyaltyLedger]);

  const handleAwardOrderStamp = async (order: Order) => {
    if (order.stampAwarded || ledgerOrderIds.has(order.id)) return;
    if (!user?.email) return;

    const phoneKey = normalizePhoneKey(order.whatsappNumber);
    if (!VALIDATION_LIMITS.PHONE_KEY_REGEX.test(phoneKey)) return;

    setAwardingOrderId(order.id);
    try {
      const phoneHash = await hashPhoneKey(phoneKey);
      const existingAcc = loyaltyAccounts.find((a) => a.phoneKey === phoneKey);
      const nextStamps = (existingAcc?.stampsCount ?? 0) + 1;
      const nextLifetime = (existingAcc?.totalStampsEarned ?? 0) + 1;
      const nextRedeemed = existingAcc?.rewardsRedeemed ?? 0;

      const batch = writeBatch(db);
      const accountRef = doc(db, 'loyalty_accounts', phoneKey);
      const publicRef = doc(db, 'loyalty_public', phoneHash);
      const ledgerRef = doc(db, 'loyalty_ledger', `order_${order.id}`);
      const orderRef = doc(db, 'orders', order.id);

      if (existingAcc) {
        batch.update(accountRef, {
          customerName: order.customerName,
          whatsappNumber: order.whatsappNumber,
          stampsCount: nextStamps,
          totalStampsEarned: nextLifetime,
          rewardsRedeemed: nextRedeemed,
          lastAwardedBy: user.email,
          lastAwardedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(accountRef, {
          phoneKey,
          phoneHash,
          whatsappNumber: order.whatsappNumber,
          customerName: order.customerName,
          stampsCount: nextStamps,
          totalStampsEarned: nextLifetime,
          rewardsRedeemed: nextRedeemed,
          lastAwardedBy: user.email,
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
        customerName: order.customerName,
        type: 'order_award',
        delta: 1,
        orderId: order.id,
        orderNumber: order.orderNumber,
        note: `Table ${order.tableNumber} order`,
        awardedBy: user.email,
        awardedAt: serverTimestamp(),
      });

      batch.update(orderRef, {
        stampAwarded: true,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `loyalty_ledger/order_${order.id}`
      );
    } finally {
      setAwardingOrderId(null);
    }
  };

  const resetDishForm = () => {
    setEditingItemId(null);
    setDishName('');
    setDishCategory(categories[0]?.name || '');
    setDishPrice('');
    setDishDescription('');
    setDishImageUrl('');
    setDishAvailable(true);
    setMenuFormError('');
  };

  const startEditDish = (item: MenuItem) => {
    setEditingItemId(item.id);
    setDishName(item.name);
    setDishCategory(item.category);
    setDishPrice(String(item.price));
    setDishDescription(item.description);
    setDishImageUrl(item.imageUrl || '');
    setDishAvailable(item.available);
    setMenuFormError('');
  };

  const handleSaveDish = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenuFormError('');

    const name = dishName.trim().slice(0, VALIDATION_LIMITS.NAME_MAX);
    const category = dishCategory.trim().slice(0, VALIDATION_LIMITS.CATEGORY_MAX);
    const description = dishDescription
      .trim()
      .slice(0, VALIDATION_LIMITS.DESCRIPTION_MAX);
    const price = Number(dishPrice);
    const imageUrl = dishImageUrl
      .trim()
      .slice(0, VALIDATION_LIMITS.IMAGE_URL_MAX);

    if (!name) {
      setMenuFormError('Dish name is required.');
      return;
    }
    if (!category) {
      setMenuFormError('Category is required.');
      return;
    }
    if (
      Number.isNaN(price) ||
      price <= 0 ||
      price > VALIDATION_LIMITS.PRICE_MAX
    ) {
      setMenuFormError(
        `Price must be between 1 and ${VALIDATION_LIMITS.PRICE_MAX}.`
      );
      return;
    }

    setSavingDish(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        category,
        description,
        price,
        available: dishAvailable,
        imageUrl,
        updatedAt: serverTimestamp(),
      };

      if (editingItemId) {
        await updateDoc(doc(db, 'menu_items', editingItemId), payload);
      } else {
        await addDoc(collection(db, 'menu_items'), {
          ...payload,
          sortOrder: menuItems.length + 1,
          createdAt: serverTimestamp(),
        });
      }
      resetDishForm();
    } catch (error) {
      handleFirestoreError(
        error,
        editingItemId ? OperationType.UPDATE : OperationType.CREATE,
        editingItemId ? `menu_items/${editingItemId}` : 'menu_items'
      );
    } finally {
      setSavingDish(false);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await updateDoc(doc(db, 'menu_items', item.id), {
        available: !item.available,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `menu_items/${item.id}`
      );
    }
  };

  const handleDeleteDish = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, 'menu_items', itemId));
      if (editingItemId === itemId) resetDishForm();
      setConfirmDeleteItemId(null);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `menu_items/${itemId}`
      );
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCategoryName.trim().slice(0, VALIDATION_LIMITS.CATEGORY_MAX);
    if (!clean) return;
    if (categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      return;
    }
    try {
      await addDoc(collection(db, 'categories'), {
        name: clean,
        sortOrder: categories.length + 1,
        createdAt: serverTimestamp(),
      });
      setNewCategoryName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'categories');
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    try {
      await deleteDoc(doc(db, 'categories', catId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${catId}`);
    }
  };

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'All') return orders;
    return orders.filter((o) => {
      if (orderFilter === 'Cancelled') {
        return o.status === 'Cancelled' || (o.status as string) === 'Rejected';
      }
      return o.status === orderFilter;
    });
  }, [orders, orderFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: orders.length };
    ORDER_STATUS_LIST.forEach((s) => {
      counts[s] = 0;
    });
    orders.forEach((o) => {
      const key = (o.status as string) === 'Rejected' ? 'Cancelled' : o.status;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [orders]);

  const totalRevenue = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            o.status !== 'Cancelled' && (o.status as string) !== 'Rejected'
        )
        .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0),
    [orders]
  );

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center p-6">
        <p className="text-sm text-[#6B5F55]">Checking admin session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-white border border-[#EAE0D3] rounded-2xl p-8 shadow-sm">
          <p className="text-xs font-semibold text-[#D95D1E]">
            Modern Bhatti · Machhapokhari, Kathmandu
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#1A1715]">
            Staff Admin Portal
          </h1>
          <p className="mt-2 text-sm text-[#5C5147] leading-relaxed">
            Sign in with your authorized Modern Bhatti Google account to manage
            live orders, loyalty stamps, menu items, and table QR codes.
          </p>

          {authError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#B91C1C]">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            className="mt-6 w-full min-h-[48px] px-4 py-3 bg-[#1A1715] text-[#FAF6F0] text-sm font-semibold rounded-xl hover:bg-[#2F2A26] transition-colors cursor-pointer"
          >
            Sign in with Google
          </button>

          <button
            type="button"
            onClick={() => onBackToCustomer()}
            className="mt-3 w-full min-h-[44px] px-4 py-2 text-sm font-medium text-[#6B5F55] hover:text-[#1A1715] transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-white border border-[#EAE0D3] rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-2 text-[#B91C1C]">
            <ShieldAlert className="w-5 h-5" />
            <h1 className="font-display text-lg font-bold text-[#1A1715]">
              Admin Access Required
            </h1>
          </div>
          <p className="mt-2 text-sm text-[#5C5147]">
            Signed in as{' '}
            <span className="font-semibold text-[#1A1715]">{user.email}</span>.
            This portal is restricted to authorized Modern Bhatti staff.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full min-h-[44px] px-4 py-2.5 bg-[#1A1715] text-[#FAF6F0] text-sm font-medium rounded-xl hover:bg-[#2F2A26] cursor-pointer"
            >
              Sign Out & Switch Account
            </button>
            <button
              type="button"
              onClick={() => onBackToCustomer()}
              className="w-full min-h-[44px] px-4 py-2.5 border border-[#E2D6C5] text-[#1A1715] text-sm font-medium rounded-xl hover:bg-[#FAF6F0] cursor-pointer"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col">
      {/* Charcoal Admin Top Bar */}
      <header className="no-print bg-[#1A1715] text-[#FAF6F0] sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            Modern Bhatti Admin
          </span>

          <nav className="flex items-center gap-1.5 sm:gap-3 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`min-h-[40px] px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-[#D95D1E] text-white'
                  : 'text-[#D6C9B8] hover:text-white hover:bg-[#2C2724]'
              }`}
            >
              Orders ({statusCounts['New'] || 0} New)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('loyalty')}
              className={`min-h-[40px] px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
                activeTab === 'loyalty'
                  ? 'bg-[#D95D1E] text-white'
                  : 'text-[#D6C9B8] hover:text-white hover:bg-[#2C2724]'
              }`}
            >
              <Award className="w-4 h-4" />
              Loyalty
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('menu')}
              className={`min-h-[40px] px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
                activeTab === 'menu'
                  ? 'bg-[#D95D1E] text-white'
                  : 'text-[#D6C9B8] hover:text-white hover:bg-[#2C2724]'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4" />
              Menu
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('qrcodes')}
              className={`min-h-[40px] px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
                activeTab === 'qrcodes'
                  ? 'bg-[#D95D1E] text-white'
                  : 'text-[#D6C9B8] hover:text-white hover:bg-[#2C2724]'
              }`}
            >
              <QrCode className="w-4 h-4" />
              QR Codes
            </button>
            <button
              type="button"
              onClick={() =>
                onBackToCustomer(
                  tables.find((t) => t.id === t.tableNumber)?.tableNumber || '01'
                )
              }
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1.5 text-xs sm:text-sm font-medium text-[#D6C9B8] hover:text-white hover:bg-[#2C2724] rounded-xl cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Preview Menu</span>
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[40px] px-3.5 py-1.5 border border-[#3B3430] text-[#FAF6F0] text-xs font-medium rounded-xl hover:bg-[#2C2724] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {newOrderToast && (
          <div className="no-print bg-[#1A1715] text-[#FAF6F0] px-4 py-3 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-2.5 text-sm font-medium">
              <Bell className="w-4 h-4 text-[#D95D1E] shrink-0" />
              <span>{newOrderToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setNewOrderToast(null)}
              aria-label="Dismiss notification"
              className="min-h-[32px] min-w-[32px] flex items-center justify-center text-[#A89B8C] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: LIVE ORDERS & HISTORY */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white border border-[#EAE0D3] rounded-2xl p-4 shadow-xs">
                <p className="text-xs text-[#6B5F55]">New Orders</p>
                <p className="mt-1 text-2xl font-bold font-mono-tabular text-[#D95D1E]">
                  {statusCounts['New'] || 0}
                </p>
              </div>
              <div className="bg-white border border-[#EAE0D3] rounded-2xl p-4 shadow-xs">
                <p className="text-xs text-[#6B5F55]">Preparing</p>
                <p className="mt-1 text-2xl font-bold font-mono-tabular text-[#1A1715]">
                  {(statusCounts['Accepted'] || 0) +
                    (statusCounts['Preparing'] || 0)}
                </p>
              </div>
              <div className="bg-white border border-[#EAE0D3] rounded-2xl p-4 shadow-xs">
                <p className="text-xs text-[#6B5F55]">Ready to Serve</p>
                <p className="mt-1 text-2xl font-bold font-mono-tabular text-emerald-700">
                  {statusCounts['Ready'] || 0}
                </p>
              </div>
              <div className="bg-white border border-[#EAE0D3] rounded-2xl p-4 shadow-xs">
                <p className="text-xs text-[#6B5F55]">Order Revenue</p>
                <p className="mt-1 text-2xl font-bold font-mono-tabular text-[#1A1715]">
                  Rs. {totalRevenue.toLocaleString()}
                </p>
              </div>
              <div className="col-span-2 lg:col-span-1 bg-white border border-[#EAE0D3] rounded-2xl p-4 flex flex-col justify-between gap-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B5F55]">Order Alert</span>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = !soundEnabled;
                      setSoundEnabled(next);
                      if (next) {
                        const ok = await unlockAudio();
                        setAudioUnlocked(ok);
                      }
                    }}
                    className="text-xs font-semibold text-[#1A1715] inline-flex items-center gap-1 cursor-pointer"
                  >
                    {soundEnabled ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
                        On
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-[#8C7E72]" />
                        Muted
                      </>
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await unlockAudio();
                    setAudioUnlocked(true);
                    await playNewOrderSound();
                  }}
                  className="min-h-[36px] px-3 py-1.5 bg-[#FAF6F0] border border-[#E2D6C5] hover:bg-[#F1E8DC] text-[#1A1715] text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  {audioUnlocked ? 'Test Alert Chime' : 'Enable & Test Chime'}
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {(['All', ...ORDER_STATUS_LIST] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setOrderFilter(status)}
                  className={`min-h-[40px] px-3.5 py-2 text-xs sm:text-sm font-medium rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    orderFilter === status
                      ? 'bg-[#1A1715] text-[#FAF6F0]'
                      : 'bg-white border border-[#EAE0D3] text-[#4A4139] hover:border-[#D95D1E]'
                  }`}
                >
                  {status} ({statusCounts[status] || 0})
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="bg-white border border-[#EAE0D3] rounded-2xl p-12 text-center shadow-sm">
                <p className="text-sm font-semibold text-[#1A1715]">
                  No orders in this view
                </p>
                <p className="mt-1 text-sm text-[#6B5F55]">
                  New table orders placed by customers will appear here
                  automatically in real time.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredOrders.map((order) => {
                  const createdStr = order.createdAt?.toDate
                    ? order.createdAt.toDate().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Just now';
                  const isCancelled =
                    order.status === 'Cancelled' ||
                    (order.status as string) === 'Rejected';
                  const alreadyAwarded =
                    Boolean(order.stampAwarded) || ledgerOrderIds.has(order.id);
                  const displayStatus =
                    (order.status as string) === 'Rejected'
                      ? 'Cancelled'
                      : order.status;

                  return (
                    <article
                      key={order.id}
                      className="bg-white border border-[#EAE0D3] rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xs"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#F1E8DC]">
                          <div>
                            <div className="flex items-center gap-2 text-xs text-[#6B5F55]">
                              <span className="font-mono-tabular font-bold text-[#1A1715]">
                                {order.orderNumber}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-bold text-[#D95D1E]">
                                Table {order.tableNumber}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-tabular">
                                {createdStr}
                              </span>
                            </div>
                            <h3 className="mt-1 text-base font-bold text-[#1A1715]">
                              {order.customerName}
                            </h3>
                            <p className="text-xs text-[#5C5147] font-mono-tabular">
                              WhatsApp: {order.whatsappNumber}
                            </p>
                          </div>

                          <span
                            className={`px-2.5 py-1 text-xs font-semibold border rounded-lg whitespace-nowrap ${
                              STATUS_STYLE[order.status] || STATUS_STYLE.New
                            }`}
                          >
                            {displayStatus}
                          </span>
                        </div>

                        <ul className="mt-3 space-y-1.5">
                          {order.items.map((item, idx) => (
                            <li
                              key={`${order.id}-${item.itemId}-${idx}`}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-[#3C342E]">
                                <span className="font-mono-tabular font-bold text-[#1A1715]">
                                  {item.quantity}×
                                </span>{' '}
                                {item.name}
                              </span>
                              <span className="font-mono-tabular text-[#5C5147]">
                                Rs. {(item.price * item.quantity).toLocaleString()}
                              </span>
                            </li>
                          ))}
                        </ul>

                        {order.specialInstructions && (
                          <div className="mt-3 p-2.5 bg-[#FAF6F0] border border-[#E6DACB] rounded-xl text-xs text-[#4A4139]">
                            <span className="font-semibold text-[#1A1715]">
                              Note:
                            </span>{' '}
                            {order.specialInstructions}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[#F1E8DC] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <span className="block text-xs text-[#786B5E]">
                              Order Total
                            </span>
                            <span className="text-base font-bold font-mono-tabular text-[#1A1715]">
                              Rs. {Number(order.totalAmount).toLocaleString()}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {order.status === 'New' && (
                              <>
                                <button
                                  type="button"
                                  disabled={updatingOrderId === order.id}
                                  onClick={() =>
                                    handleUpdateOrderStatus(order.id, 'Accepted')
                                  }
                                  className="min-h-[40px] px-3.5 py-2 bg-[#1A1715] text-[#FAF6F0] text-xs font-semibold rounded-xl hover:bg-[#2F2A26] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  disabled={updatingOrderId === order.id}
                                  onClick={() =>
                                    handleUpdateOrderStatus(
                                      order.id,
                                      'Cancelled'
                                    )
                                  }
                                  className="min-h-[40px] px-3.5 py-2 border border-red-200 text-[#B91C1C] bg-red-50 text-xs font-semibold rounded-xl hover:bg-red-100 disabled:opacity-50 cursor-pointer"
                                >
                                  Cancel Order
                                </button>
                              </>
                            )}

                            {order.status === 'Accepted' && (
                              <button
                                type="button"
                                disabled={updatingOrderId === order.id}
                                onClick={() =>
                                  handleUpdateOrderStatus(order.id, 'Preparing')
                                }
                                className="min-h-[40px] px-3.5 py-2 bg-[#D95D1E] text-white text-xs font-semibold rounded-xl hover:bg-[#C24D12] disabled:opacity-50 cursor-pointer"
                              >
                                Start Preparing
                              </button>
                            )}

                            {order.status === 'Preparing' && (
                              <button
                                type="button"
                                disabled={updatingOrderId === order.id}
                                onClick={() =>
                                  handleUpdateOrderStatus(order.id, 'Ready')
                                }
                                className="min-h-[40px] px-3.5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-xl hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                              >
                                Mark Ready
                              </button>
                            )}

                            {order.status === 'Ready' && (
                              <button
                                type="button"
                                disabled={updatingOrderId === order.id}
                                onClick={() =>
                                  handleUpdateOrderStatus(order.id, 'Completed')
                                }
                                className="min-h-[40px] px-3.5 py-2 bg-[#1A1715] text-[#FAF6F0] text-xs font-semibold rounded-xl hover:bg-[#2F2A26] disabled:opacity-50 cursor-pointer"
                              >
                                Mark Completed
                              </button>
                            )}

                            <select
                              aria-label={`Change status for order ${order.orderNumber}`}
                              value={displayStatus}
                              disabled={updatingOrderId === order.id}
                              onChange={(e) =>
                                handleUpdateOrderStatus(
                                  order.id,
                                  e.target.value as OrderStatusValue
                                )
                              }
                              className="min-h-[40px] px-2.5 py-1.5 text-xs border border-[#E2D6C5] rounded-xl bg-[#FAF6F0] text-[#1A1715] focus:outline-none focus:ring-2 focus:ring-[#D95D1E] cursor-pointer"
                            >
                              {ORDER_STATUS_LIST.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Loyalty Stamp Award Action */}
                        {!isCancelled && (
                          <div className="pt-2.5 border-t border-[#F1E8DC] flex items-center justify-between gap-2">
                            <span className="text-xs text-[#6B5F55]">
                              Loyalty Program ({order.whatsappNumber})
                            </span>
                            {alreadyAwarded ? (
                              <span className="text-xs font-semibold text-emerald-700 inline-flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                Stamp Awarded
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={awardingOrderId === order.id}
                                onClick={() => handleAwardOrderStamp(order)}
                                className="min-h-[36px] px-3 py-1.5 bg-[#FAF6F0] border border-[#D95D1E] text-[#D95D1E] hover:bg-[#D95D1E] hover:text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              >
                                <Award className="w-3.5 h-3.5" />
                                {awardingOrderId === order.id
                                  ? 'Awarding...'
                                  : 'Award +1 Loyalty Stamp'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LOYALTY STAMPS */}
        {activeTab === 'loyalty' && (
          <LoyaltyManager
            adminEmail={user.email || ADMIN_EMAIL}
            settings={loyaltySettings}
            accounts={loyaltyAccounts}
            ledger={loyaltyLedger}
          />
        )}

        {/* TAB 3: MENU MANAGEMENT */}
        {activeTab === 'menu' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-[#EAE0D3] rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-base font-bold text-[#1A1715]">
                    {editingItemId ? 'Edit Dish' : 'Add Food Item'}
                  </h2>
                  {editingItemId && (
                    <button
                      type="button"
                      onClick={resetDishForm}
                      className="text-xs font-medium text-[#6B5F55] hover:text-[#1A1715] cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveDish} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="dish-name"
                      className="block text-xs font-medium text-[#5C5147] mb-1"
                    >
                      Dish Name *
                    </label>
                    <input
                      id="dish-name"
                      type="text"
                      required
                      maxLength={VALIDATION_LIMITS.NAME_MAX}
                      value={dishName}
                      onChange={(e) => setDishName(e.target.value)}
                      placeholder="e.g. Bhatti Chicken Dum Biryani"
                      className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="dish-category"
                        className="block text-xs font-medium text-[#5C5147] mb-1"
                      >
                        Category *
                      </label>
                      <input
                        id="dish-category"
                        list="menu-categories-list"
                        required
                        maxLength={VALIDATION_LIMITS.CATEGORY_MAX}
                        value={dishCategory}
                        onChange={(e) => setDishCategory(e.target.value)}
                        placeholder="Select or type"
                        className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
                      />
                      <datalist id="menu-categories-list">
                        {categories.map((c) => (
                          <option key={c.id} value={c.name} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label
                        htmlFor="dish-price"
                        className="block text-xs font-medium text-[#5C5147] mb-1"
                      >
                        Price (Rs.) *
                      </label>
                      <input
                        id="dish-price"
                        type="number"
                        min={1}
                        max={VALIDATION_LIMITS.PRICE_MAX}
                        required
                        value={dishPrice}
                        onChange={(e) => setDishPrice(e.target.value)}
                        placeholder="380"
                        className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl font-mono-tabular focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="dish-description"
                      className="block text-xs font-medium text-[#5C5147] mb-1"
                    >
                      Description
                    </label>
                    <textarea
                      id="dish-description"
                      rows={3}
                      maxLength={VALIDATION_LIMITS.DESCRIPTION_MAX}
                      value={dishDescription}
                      onChange={(e) => setDishDescription(e.target.value)}
                      placeholder="Short description of ingredients or preparation"
                      className="w-full px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E] resize-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="dish-image"
                      className="block text-xs font-medium text-[#5C5147] mb-1"
                    >
                      Real Photo URL (Optional — leave blank for placeholder)
                    </label>
                    <input
                      id="dish-image"
                      type="url"
                      maxLength={VALIDATION_LIMITS.IMAGE_URL_MAX}
                      value={dishImageUrl}
                      onChange={(e) => setDishImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
                    />
                  </div>

                  <label className="flex items-center gap-2.5 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dishAvailable}
                      onChange={(e) => setDishAvailable(e.target.checked)}
                      className="w-4 h-4 rounded border-[#D8CBB9] text-[#D95D1E] focus:ring-[#D95D1E]"
                    />
                    <span className="text-sm text-[#1A1715]">
                      Available for ordering
                    </span>
                  </label>

                  {menuFormError && (
                    <p className="text-xs text-[#B91C1C]">{menuFormError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={savingDish}
                    className="w-full min-h-[44px] px-4 py-2.5 bg-[#D95D1E] text-white text-sm font-semibold rounded-xl hover:bg-[#C24D12] disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    {savingDish
                      ? 'Saving...'
                      : editingItemId
                      ? 'Save Changes'
                      : 'Add Dish to Menu'}
                  </button>
                </form>
              </div>

              <div className="bg-white border border-[#EAE0D3] rounded-2xl p-5 shadow-sm">
                <h2 className="font-display text-base font-bold text-[#1A1715]">
                  Categories
                </h2>
                <form
                  onSubmit={handleAddCategory}
                  className="mt-3 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    maxLength={VALIDATION_LIMITS.CATEGORY_MAX}
                    placeholder="New category name"
                    className="flex-1 min-h-[40px] px-3 py-1.5 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
                  />
                  <button
                    type="submit"
                    className="min-h-[40px] px-3.5 py-1.5 bg-[#1A1715] text-[#FAF6F0] text-xs font-medium rounded-xl hover:bg-[#2F2A26] cursor-pointer"
                  >
                    Add
                  </button>
                </form>

                <ul className="mt-3 divide-y divide-[#F1E8DC]">
                  {categories.map((cat) => (
                    <li
                      key={cat.id}
                      className="py-2 flex items-center justify-between text-sm"
                    >
                      <span className="text-[#1A1715]">{cat.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        aria-label={`Delete category ${cat.name}`}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#8C7E72] hover:text-[#B91C1C] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-4">
              {needsCategoryUpgrade && (
                <div className="bg-[#FFF4EC] border border-[#F2C6A7] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-5 h-5 text-[#D95D1E] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-[#1A1715]">
                        Load Standard 6-Category Menu
                      </p>
                      <p className="text-xs text-[#5C5147]">
                        Add Biryani, Sekuwa and Grilled Items, Grilled Chicken,
                        Snacks and Starters, Drinks, and Chiya and Hot Beverages.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={seedingDefaults}
                    onClick={() => seedDefaultRestaurantData(true)}
                    className="min-h-[40px] px-4 py-2 bg-[#D95D1E] text-white text-xs font-semibold rounded-xl hover:bg-[#C24D12] disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {seedingDefaults ? 'Loading...' : 'Add 6 Categories & Dishes'}
                  </button>
                </div>
              )}

              {menuItems.length === 0 && (
                <div className="bg-white border border-[#EAE0D3] rounded-2xl p-8 text-center shadow-sm">
                  <p className="text-sm font-semibold text-[#1A1715]">
                    Your menu is currently empty
                  </p>
                  <p className="mt-1 text-sm text-[#6B5F55]">
                    Add items manually on the left or load Modern Bhatti&rsquo;s
                    6-category menu.
                  </p>
                  <button
                    type="button"
                    disabled={seedingDefaults}
                    onClick={() => seedDefaultRestaurantData(true)}
                    className="mt-4 min-h-[44px] px-5 py-2.5 bg-[#D95D1E] text-white text-sm font-semibold rounded-xl hover:bg-[#C24D12] disabled:opacity-50 cursor-pointer"
                  >
                    {seedingDefaults
                      ? 'Loading Menu...'
                      : 'Load Default 6-Category Menu'}
                  </button>
                </div>
              )}

              {menuItems.length > 0 && (
                <div className="bg-white border border-[#EAE0D3] rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-[#F1E8DC] flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-[#1A1715]">
                      Menu Items ({menuItems.length})
                    </h2>
                  </div>
                  <div className="divide-y divide-[#F1E8DC]">
                    {menuItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs text-[#6B5F55]">
                            <span>{item.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular font-bold text-[#1A1715]">
                              Rs. {item.price.toLocaleString()}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                item.available
                                  ? 'text-emerald-700 font-semibold'
                                  : 'text-[#B91C1C] font-semibold'
                              }
                            >
                              {item.available ? 'Available' : 'Unavailable'}
                            </span>
                          </div>
                          <h3 className="mt-0.5 text-sm font-bold text-[#1A1715]">
                            {item.name}
                          </h3>
                          <p className="text-xs text-[#6B5F55] line-clamp-1">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleAvailability(item)}
                            className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                              item.available
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                : 'border-[#E2D6C5] bg-[#FAF6F0] text-[#5C5147] hover:bg-[#EDE3D6]'
                            }`}
                          >
                            {item.available
                              ? 'Mark Unavailable'
                              : 'Mark Available'}
                          </button>

                          <button
                            type="button"
                            onClick={() => startEditDish(item)}
                            aria-label={`Edit ${item.name}`}
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center border border-[#E2D6C5] rounded-xl text-[#1A1715] hover:bg-[#FAF6F0] cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {confirmDeleteItemId === item.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteDish(item.id)}
                                className="min-h-[38px] px-2.5 bg-[#B91C1C] text-white text-xs font-medium rounded-xl hover:bg-[#991B1B] cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteItemId(null)}
                                className="min-h-[38px] px-2 text-xs text-[#6B5F55] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteItemId(item.id)}
                              aria-label={`Delete ${item.name}`}
                              className="min-h-[38px] min-w-[38px] flex items-center justify-center border border-[#E2D6C5] rounded-xl text-[#8C7E72] hover:text-[#B91C1C] hover:border-red-200 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: QR CODE MANAGEMENT */}
        {activeTab === 'qrcodes' && (
          <QrCodeManager
            tables={tables}
            onPreviewTable={(tableNum) => onBackToCustomer(tableNum)}
          />
        )}
      </main>
    </div>
  );
}
