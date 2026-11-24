import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  CheckCircle2,
  Coffee,
  CupSoda,
  Drumstick,
  Flame,
  MapPin,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Soup,
  Trash2,
  Utensils,
  XCircle,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  CartItem,
  Category,
  MenuItem,
  OrderItem,
  OrderStatusDoc,
  OrderStatusValue,
  RestaurantTable,
  VALIDATION_LIMITS,
} from '../types';
import { CustomerLoyaltyPanel } from './CustomerLoyaltyPanel';

interface CustomerOrderViewProps {
  tableFromUrl: string;
}

interface PlacedOrderSummary {
  orderId: string;
  orderNumber: string;
  tableNumber: string;
  customerName: string;
  whatsappNumber: string;
  items: OrderItem[];
  totalAmount: number;
}

function getCategoryIcon(categoryName: string) {
  const lower = categoryName.toLowerCase();
  if (lower.includes('biryani')) return Soup;
  if (lower.includes('sekuwa') || lower.includes('grill')) {
    return lower.includes('chicken') ? Drumstick : Flame;
  }
  if (lower.includes('chiya') || lower.includes('hot')) return Coffee;
  if (lower.includes('drink')) return CupSoda;
  return Utensils;
}

function DishMedia({ item }: { item: MenuItem }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (item.imageUrl && !imgFailed) {
    return (
      <div className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-xl overflow-hidden bg-[#F3ECE1] border border-[#E6DACB]">
        <img
          src={item.imageUrl}
          alt={item.name}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const IconComponent = getCategoryIcon(item.category);

  return (
    <div
      aria-hidden="true"
      className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-xl bg-gradient-to-br from-[#F7EFE4] to-[#EDE1D0] border border-[#E2D4C0] flex flex-col items-center justify-center p-2 text-center select-none"
    >
      <IconComponent className="w-5 h-5 text-[#D95D1E] stroke-[1.75] shrink-0" />
      <span className="mt-1.5 text-[10px] leading-tight font-semibold text-[#5C5147] line-clamp-2">
        {item.name}
      </span>
    </div>
  );
}

const STATUS_DESCRIPTIONS: Record<string, string> = {
  New: 'Order received — Waiting for Modern Bhatti kitchen to accept.',
  Accepted: 'Order accepted! Our kitchen team is queueing your dishes.',
  Preparing: 'Your food is being freshly grilled and prepared now.',
  Ready: 'Your order is ready and heading to your table!',
  Completed: 'Served and completed. Enjoy your meal at Modern Bhatti!',
  Cancelled:
    'This order was cancelled by the restaurant. Please check with our staff if you have questions.',
  Rejected:
    'This order was cancelled by the restaurant. Please check with our staff if you have questions.',
};

const ACTIVE_STEPS: OrderStatusValue[] = [
  'New',
  'Accepted',
  'Preparing',
  'Ready',
  'Completed',
];

export function CustomerOrderView({ tableFromUrl }: CustomerOrderViewProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [loadingTables, setLoadingTables] = useState(true);

  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  const [customerName, setCustomerName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [placedOrder, setPlacedOrder] = useState<PlacedOrderSummary | null>(null);
  const [liveStatus, setLiveStatus] = useState<string>('New');

  const checkoutSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsubMenu = onSnapshot(
      collection(db, 'menu_items'),
      (snap) => {
        const items: MenuItem[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MenuItem, 'id'>),
        }));
        setMenuItems(items);
        setLoadingMenu(false);
      },
      (error) => {
        setLoadingMenu(false);
        handleFirestoreError(error, OperationType.LIST, 'menu_items');
      }
    );

    const unsubCats = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        const cats: Category[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Category, 'id'>),
          }))
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setCategories(cats);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'categories');
      }
    );

    const unsubTables = onSnapshot(
      collection(db, 'tables'),
      (snap) => {
        const tbls: RestaurantTable[] = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<RestaurantTable, 'id'>),
          }))
          .filter((t) => t.active && t.id === t.tableNumber);
        setTables(tbls);
        setLoadingTables(false);
      },
      (error) => {
        setLoadingTables(false);
        handleFirestoreError(error, OperationType.LIST, 'tables');
      }
    );

    return () => {
      unsubMenu();
      unsubCats();
      unsubTables();
    };
  }, []);

  const verifiedTable = useMemo(() => {
    const raw = tableFromUrl.trim();
    if (!raw) return null;
    const exact = tables.find(
      (t) => t.tableNumber.toLowerCase() === raw.toLowerCase()
    );
    if (exact) return exact;
    if (/^\d+$/.test(raw)) {
      const padded = raw.padStart(2, '0');
      return tables.find((t) => t.tableNumber === padded) || null;
    }
    return null;
  }, [tableFromUrl, tables]);

  // Restore recent order for this table if page refreshed while waiting
  useEffect(() => {
    if (!verifiedTable || placedOrder) return;
    try {
      const saved = sessionStorage.getItem(
        `mb_active_order_${verifiedTable.tableNumber}`
      );
      if (saved) {
        const parsed = JSON.parse(saved) as PlacedOrderSummary;
        if (parsed?.orderId) {
          setPlacedOrder(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [verifiedTable, placedOrder]);

  useEffect(() => {
    if (!placedOrder) return;
    const unsubStatus = onSnapshot(
      doc(db, 'order_status', placedOrder.orderId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<OrderStatusDoc, 'id'>;
          setLiveStatus(data.status);
        }
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.GET,
          `order_status/${placedOrder.orderId}`
        );
      }
    );
    return () => unsubStatus();
  }, [placedOrder]);

  const categoryNames = useMemo(() => {
    const names = categories.map((c) => c.name);
    menuItems.forEach((item) => {
      if (item.category && !names.includes(item.category)) {
        names.push(item.category);
      }
    });
    return names;
  }, [categories, menuItems]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: menuItems.length };
    menuItems.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    const queryLower = searchQuery.trim().toLowerCase();
    return menuItems
      .filter((item) => {
        if (activeCategory !== 'All' && item.category !== activeCategory) {
          return false;
        }
        if (
          queryLower &&
          !item.name.toLowerCase().includes(queryLower) &&
          !item.description.toLowerCase().includes(queryLower)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.available !== b.available) return a.available ? -1 : 1;
        return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
      });
  }, [menuItems, activeCategory, searchQuery]);

  const groupedItems = useMemo(() => {
    if (activeCategory !== 'All') {
      return [{ category: activeCategory, items: filteredItems }];
    }
    const groups: { category: string; items: MenuItem[] }[] = [];
    const orderedCats = categoryNames.length
      ? categoryNames
      : Array.from(new Set(filteredItems.map((i) => i.category)));

    orderedCats.forEach((cat) => {
      const catItems = filteredItems.filter((i) => i.category === cat);
      if (catItems.length > 0) {
        groups.push({ category: cat, items: catItems });
      }
    });
    return groups;
  }, [activeCategory, categoryNames, filteredItems]);

  const getCartQuantity = (itemId: string) =>
    cart.find((c) => c.item.id === itemId)?.quantity ?? 0;

  const addToCart = (item: MenuItem) => {
    if (!item.available) return;
    setFormError('');
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id
            ? { ...c, quantity: Math.min(99, c.quantity + 1) }
            : c
        );
      }
      if (prev.length >= VALIDATION_LIMITS.ORDER_ITEMS_MAX) {
        setFormError(
          `Maximum ${VALIDATION_LIMITS.ORDER_ITEMS_MAX} distinct dishes per order. Place an additional order for more items.`
        );
        return prev;
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const updateCartQuantity = (itemId: string, delta: number) => {
    setFormError('');
    setCart((prev) =>
      prev
        .map((c) =>
          c.item.id === itemId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (itemId: string) => {
    setFormError('');
    setCart((prev) => prev.filter((c) => c.item.id !== itemId));
  };

  const totalItemCount = useMemo(
    () => cart.reduce((sum, c) => sum + c.quantity, 0),
    [cart]
  );

  const totalAmount = useMemo(
    () => cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0),
    [cart]
  );

  const cleanName = customerName.trim();
  const cleanPhone = whatsappNumber.trim();
  const isNameValid =
    cleanName.length >= 2 && cleanName.length <= VALIDATION_LIMITS.CUSTOMER_NAME_MAX;
  const isPhoneValid = VALIDATION_LIMITS.WHATSAPP_REGEX.test(cleanPhone);
  const isCheckoutReady =
    Boolean(verifiedTable) && cart.length > 0 && isNameValid && isPhoneValid;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!verifiedTable) {
      setFormError('Invalid or missing table QR code.');
      return;
    }
    if (cart.length === 0) {
      setFormError('Please add at least one item from the menu.');
      return;
    }
    if (!isNameValid) {
      setFormError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!isPhoneValid) {
      setFormError(
        'Please enter a valid WhatsApp number (7–20 digits, e.g. 9841234567).'
      );
      return;
    }

    const cleanNotes = specialInstructions
      .trim()
      .slice(0, VALIDATION_LIMITS.INSTRUCTIONS_MAX);

    const orderItems: OrderItem[] = cart.map((c) => ({
      itemId: c.item.id,
      name: c.item.name.slice(0, VALIDATION_LIMITS.NAME_MAX),
      price: Number(c.item.price),
      quantity: Math.max(1, Math.min(99, Math.floor(c.quantity))),
    }));

    const computedTotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    if (computedTotal <= 0 || computedTotal > VALIDATION_LIMITS.TOTAL_MAX) {
      setFormError('Order total exceeds allowed limits.');
      return;
    }

    const orderRef = doc(collection(db, 'orders'));
    const statusRef = doc(db, 'order_status', orderRef.id);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `MB-${randomSuffix}`;

    setSubmitting(true);
    try {
      const batch = writeBatch(db);
      batch.set(orderRef, {
        orderNumber,
        tableNumber: verifiedTable.tableNumber,
        customerName: cleanName.slice(0, VALIDATION_LIMITS.CUSTOMER_NAME_MAX),
        whatsappNumber: cleanPhone,
        specialInstructions: cleanNotes,
        items: orderItems,
        totalAmount: computedTotal,
        status: 'New',
        stampAwarded: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(statusRef, {
        orderNumber,
        tableNumber: verifiedTable.tableNumber,
        status: 'New',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      const summary: PlacedOrderSummary = {
        orderId: orderRef.id,
        orderNumber,
        tableNumber: verifiedTable.tableNumber,
        customerName: cleanName,
        whatsappNumber: cleanPhone,
        items: orderItems,
        totalAmount: computedTotal,
      };

      try {
        sessionStorage.setItem(
          `mb_active_order_${verifiedTable.tableNumber}`,
          JSON.stringify(summary)
        );
      } catch {
        // ignore storage errors
      }

      setPlacedOrder(summary);
      setLiveStatus('New');
      setCart([]);
      setSpecialInstructions('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `orders/${orderRef.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNewOrder = () => {
    if (verifiedTable) {
      try {
        sessionStorage.removeItem(
          `mb_active_order_${verifiedTable.tableNumber}`
        );
      } catch {
        // ignore
      }
    }
    setPlacedOrder(null);
  };

  const scrollToCheckout = () => {
    checkoutSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loadingTables) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex items-center justify-center p-6">
        <p className="text-sm text-[#6B5F55]">Detecting your table...</p>
      </div>
    );
  }

  // Missing or Invalid QR Table Guard (No manual table entry, no admin links)
  if (!verifiedTable) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col">
        <header className="bg-[#1A1715] text-[#FAF6F0] px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="font-display text-lg font-bold tracking-tight">
            Modern Bhatti
          </span>
          <span className="text-xs text-[#D6C9B8]">
            Machhapokhari, Kathmandu
          </span>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#EAE0D3] rounded-2xl p-8 text-center shadow-sm">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FAF6F0] border border-[#E6DACB] flex items-center justify-center text-[#D95D1E]">
              <QrCode className="w-7 h-7" />
            </div>
            <h1 className="mt-4 font-display text-xl font-bold text-[#1A1715]">
              {tableFromUrl
                ? `Table "${tableFromUrl}" Not Active`
                : 'Scan Your Table QR Code'}
            </h1>
            <p className="mt-2 text-sm text-[#6B5F55] leading-relaxed">
              Please scan the QR code placed on your table at Modern Bhatti to
              automatically load your table number and browse our menu.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Order Confirmation & Real-Time Status View
  if (placedOrder) {
    const isCancelled =
      liveStatus === 'Cancelled' || liveStatus === 'Rejected';
    const currentStepIdx = ACTIVE_STEPS.indexOf(
      liveStatus as OrderStatusValue
    );

    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col">
        <header className="bg-[#1A1715] text-[#FAF6F0] px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            Modern Bhatti
          </span>
          <span className="text-xs sm:text-sm font-semibold text-[#F4B897] whitespace-nowrap shrink-0">
            Table {placedOrder.tableNumber}
          </span>
          <button
            type="button"
            onClick={handleStartNewOrder}
            className="min-h-[40px] px-4 py-2 bg-[#D95D1E] text-white text-xs font-semibold rounded-xl hover:bg-[#C24D12] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Order More
          </button>
        </header>

        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 space-y-6">
          <div className="bg-white border border-[#EAE0D3] rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-start gap-3.5">
              {isCancelled ? (
                <XCircle className="w-8 h-8 text-[#B91C1C] shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-emerald-700 shrink-0 mt-0.5" />
              )}
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-[#1A1715]">
                  {isCancelled ? 'Order Cancelled' : 'Order Received'}
                </h1>
                <p className="mt-2 text-sm sm:text-base text-[#4A4139] leading-relaxed">
                  {isCancelled
                    ? STATUS_DESCRIPTIONS.Cancelled
                    : 'Thank you for your order! Your order has been successfully received by Modern Bhatti. Our team will start processing it shortly.'}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 py-4 border-y border-[#F1E8DC]">
              <div>
                <span className="block text-xs text-[#786B5E]">
                  Order Number
                </span>
                <span className="mt-1 block text-lg font-bold font-mono-tabular text-[#1A1715]">
                  {placedOrder.orderNumber}
                </span>
              </div>
              <div>
                <span className="block text-xs text-[#786B5E]">
                  Table Number
                </span>
                <span className="mt-1 block text-lg font-bold font-mono-tabular text-[#1A1715]">
                  Table {placedOrder.tableNumber}
                </span>
              </div>
            </div>

            {/* Live Order Status Progress */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-[#6B5F55]">
                <span>Live Kitchen Status</span>
                <span
                  className={`font-bold ${
                    isCancelled ? 'text-[#B91C1C]' : 'text-[#D95D1E]'
                  }`}
                >
                  {liveStatus === 'Rejected' ? 'Cancelled' : liveStatus}
                </span>
              </div>
              <p
                className={`mt-1 text-sm font-medium ${
                  isCancelled ? 'text-[#B91C1C]' : 'text-[#1A1715]'
                }`}
              >
                {STATUS_DESCRIPTIONS[liveStatus] || STATUS_DESCRIPTIONS.New}
              </p>

              {!isCancelled && (
                <div className="mt-4 grid grid-cols-5 gap-1.5">
                  {ACTIVE_STEPS.map((step, idx) => {
                    const reached =
                      currentStepIdx >= 0 && idx <= currentStepIdx;
                    return (
                      <div key={step} className="space-y-1">
                        <div
                          className={`h-2 rounded-full transition-colors ${
                            reached ? 'bg-[#D95D1E]' : 'bg-[#EDE3D6]'
                          }`}
                        />
                        <span
                          className={`block text-[10px] text-center truncate ${
                            reached
                              ? 'font-semibold text-[#1A1715]'
                              : 'text-[#8C7E72]'
                          }`}
                        >
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 pt-5 border-t border-[#F1E8DC]">
              <h2 className="text-sm font-bold text-[#1A1715]">
                Ordered Items ({placedOrder.customerName})
              </h2>
              <ul className="mt-3 divide-y divide-[#F1E8DC]">
                {placedOrder.items.map((item) => (
                  <li
                    key={item.itemId}
                    className="py-2.5 flex items-center justify-between text-sm"
                  >
                    <span className="text-[#3C342E]">
                      <span className="font-mono-tabular font-semibold text-[#1A1715]">
                        {item.quantity}×
                      </span>{' '}
                      {item.name}
                    </span>
                    <span className="font-mono-tabular text-[#1A1715] font-medium">
                      Rs. {(item.price * item.quantity).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 pt-3 border-t border-[#E6DACB] flex items-center justify-between">
                <span className="text-sm font-semibold text-[#1A1715]">
                  Total Amount
                </span>
                <span className="text-lg font-bold font-mono-tabular text-[#1A1715]">
                  Rs. {placedOrder.totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartNewOrder}
              className="mt-7 w-full min-h-[48px] px-4 py-3 bg-[#1A1715] text-[#FAF6F0] text-sm font-semibold rounded-xl hover:bg-[#2F2A26] transition-colors cursor-pointer"
            >
              Order More Items for Table {placedOrder.tableNumber}
            </button>
          </div>

          <CustomerLoyaltyPanel initialWhatsapp={placedOrder.whatsappNumber} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col pb-24 lg:pb-12">
      {/* Charcoal Top Navigation Bar (Zero Admin Links) */}
      <header className="bg-[#1A1715] text-[#FAF6F0] sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#menu"
            className="font-display text-lg font-bold tracking-tight text-[#FAF6F0] whitespace-nowrap shrink-0"
          >
            Modern Bhatti
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#D6C9B8]">
            <a
              href="#categories"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Categories
            </a>
            <a
              href="#menu"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Menu
            </a>
            <a
              href="#loyalty"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Loyalty Card
            </a>
            <a
              href="#checkout"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Order Summary
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={scrollToCheckout}
              className="min-h-[40px] px-4 py-2 bg-[#D95D1E] text-white text-xs font-semibold rounded-xl hover:bg-[#C24D12] transition-colors inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="font-mono-tabular">
                Cart ({totalItemCount})
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Automatically Detected Table Banner */}
      <section className="bg-[#F3ECE1] border-b border-[#E6DACB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#6B5F55]">
              <MapPin className="w-3.5 h-3.5 text-[#D95D1E]" />
              <span>Machhapokhari, Kathmandu</span>
              <span aria-hidden="true">·</span>
              <span>Authentic Charcoal Bhatti & Kitchen</span>
              {verifiedTable.label && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{verifiedTable.label}</span>
                </>
              )}
            </div>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#1A1715]">
              Table {verifiedTable.tableNumber}
            </h1>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#8C7E72] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search biryani, sekuwa, chiya..."
              aria-label="Search menu items"
              className="w-full min-h-[44px] pl-10 pr-3 py-2 text-sm bg-white border border-[#E2D6C5] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#D95D1E] shadow-xs"
            />
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Beautiful Food Category Cards */}
        <section id="categories" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-base sm:text-lg font-bold text-[#1A1715]">
              Explore Categories
            </h2>
            {activeCategory !== 'All' && (
              <button
                type="button"
                onClick={() => setActiveCategory('All')}
                className="text-xs font-semibold text-[#D95D1E] hover:text-[#B91C1C] cursor-pointer"
              >
                Show All Dishes
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <button
              type="button"
              onClick={() => setActiveCategory('All')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[88px] ${
                activeCategory === 'All'
                  ? 'bg-[#1A1715] border-[#1A1715] text-[#FAF6F0] shadow-sm'
                  : 'bg-white border-[#EAE0D3] text-[#1A1715] hover:border-[#D95D1E] shadow-xs'
              }`}
            >
              <Utensils
                className={`w-5 h-5 ${
                  activeCategory === 'All'
                    ? 'text-[#D95D1E]'
                    : 'text-[#D95D1E]'
                }`}
              />
              <div className="mt-2">
                <span className="block text-xs font-bold leading-tight">
                  All Dishes
                </span>
                <span
                  className={`text-[11px] font-mono-tabular ${
                    activeCategory === 'All'
                      ? 'text-[#D6C9B8]'
                      : 'text-[#786B5E]'
                  }`}
                >
                  {categoryCounts['All'] || 0} items
                </span>
              </div>
            </button>

            {categoryNames.map((cat) => {
              const IconComp = getCategoryIcon(cat);
              const isSelected = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[88px] ${
                    isSelected
                      ? 'bg-[#D95D1E] border-[#D95D1E] text-white shadow-sm'
                      : 'bg-white border-[#EAE0D3] text-[#1A1715] hover:border-[#D95D1E] shadow-xs'
                  }`}
                >
                  <IconComp
                    className={`w-5 h-5 ${
                      isSelected ? 'text-white' : 'text-[#D95D1E]'
                    }`}
                  />
                  <div className="mt-2">
                    <span className="block text-xs font-bold leading-tight line-clamp-2">
                      {cat}
                    </span>
                    <span
                      className={`text-[11px] font-mono-tabular ${
                        isSelected ? 'text-orange-100' : 'text-[#786B5E]'
                      }`}
                    >
                      {categoryCounts[cat] || 0} items
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Menu Grid + Sticky Checkout Panel */}
        <main
          id="menu"
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
        >
          {/* Left 8 cols: Dishes */}
          <div className="lg:col-span-8 space-y-8">
            {loadingMenu ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-36 bg-white border border-[#EAE0D3] rounded-2xl animate-pulse"
                  />
                ))}
              </div>
            ) : groupedItems.length === 0 ? (
              <div className="bg-white border border-[#EAE0D3] rounded-2xl p-10 text-center shadow-sm">
                <p className="text-sm font-semibold text-[#1A1715]">
                  No dishes found
                </p>
                <p className="mt-1 text-sm text-[#6B5F55]">
                  {menuItems.length === 0
                    ? 'The Modern Bhatti kitchen is updating today’s menu.'
                    : 'Try clearing your search or selecting another category.'}
                </p>
              </div>
            ) : (
              groupedItems.map((group) => (
                <section key={group.category}>
                  <div className="flex items-baseline justify-between border-b border-[#E2D6C5] pb-2 mb-4">
                    <h2 className="font-display text-lg font-bold text-[#1A1715]">
                      {group.category}
                    </h2>
                    <span className="text-xs font-mono-tabular text-[#6B5F55]">
                      {group.items.length} items
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.items.map((item) => {
                      const qty = getCartQuantity(item.id);
                      return (
                        <article
                          key={item.id}
                          className={`bg-white border border-[#EAE0D3] rounded-2xl p-4 flex gap-4 justify-between shadow-xs transition-all ${
                            item.available
                              ? 'hover:shadow-md hover:border-[#D9C7B2]'
                              : 'opacity-65 bg-[#F5EFE6]'
                          }`}
                        >
                          <DishMedia item={item} />

                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center gap-2 text-[11px] text-[#786B5E]">
                                <span>{item.category}</span>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={
                                    item.available
                                      ? 'text-emerald-700 font-semibold'
                                      : 'text-[#B91C1C] font-semibold'
                                  }
                                >
                                  {item.available
                                    ? 'Available'
                                    : 'Unavailable'}
                                </span>
                              </div>
                              <h3 className="mt-0.5 text-base font-bold text-[#1A1715] leading-snug">
                                {item.name}
                              </h3>
                              <p className="mt-1 text-xs text-[#6B5F55] line-clamp-2 leading-relaxed">
                                {item.description}
                              </p>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className="text-sm font-bold font-mono-tabular text-[#1A1715]">
                                Rs. {item.price.toLocaleString()}
                              </span>

                              {!item.available ? (
                                <span className="text-xs font-medium text-[#8C7E72]">
                                  Sold Out
                                </span>
                              ) : qty === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => addToCart(item)}
                                  className="min-h-[40px] px-4 py-2 bg-[#D95D1E] text-white text-xs font-semibold rounded-xl hover:bg-[#C24D12] transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Add to Cart
                                </button>
                              ) : (
                                <div className="inline-flex items-center border border-[#E2D6C5] rounded-xl bg-[#FAF6F0]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCartQuantity(item.id, -1)
                                    }
                                    aria-label={`Decrease ${item.name} quantity`}
                                    className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#1A1715] hover:bg-[#EDE3D6] rounded-l-xl cursor-pointer"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <span className="px-2.5 text-sm font-bold font-mono-tabular text-[#1A1715]">
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => updateCartQuantity(item.id, 1)}
                                    aria-label={`Increase ${item.name} quantity`}
                                    className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#1A1715] hover:bg-[#EDE3D6] rounded-r-xl cursor-pointer"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>

          {/* Right 4 cols: Order Summary & Required Customer Information */}
          <aside
            id="checkout"
            ref={checkoutSectionRef}
            className="lg:col-span-4 lg:sticky lg:top-20 space-y-6"
          >
            <div className="bg-white border border-[#EAE0D3] rounded-2xl p-5 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-[#F1E8DC]">
                <h2 className="font-display text-lg font-bold text-[#1A1715]">
                  Your Order
                </h2>
                <span className="text-xs font-bold text-[#D95D1E]">
                  Table {verifiedTable.tableNumber}
                </span>
              </div>

              {cart.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-[#6B5F55]">
                    Your tray is empty. Tap &ldquo;Add to Cart&rdquo; on any
                    dish to start your order.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[#F1E8DC] max-h-72 overflow-y-auto">
                  {cart.map(({ item, quantity }) => (
                    <li
                      key={item.id}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#1A1715] truncate">
                          {item.name}
                        </p>
                        <p className="text-xs font-mono-tabular text-[#6B5F55]">
                          Rs. {item.price.toLocaleString()} × {quantity}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, -1)}
                          aria-label={`Decrease ${item.name}`}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center border border-[#E2D6C5] rounded-lg text-[#1A1715] hover:bg-[#FAF6F0] cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold font-mono-tabular">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, 1)}
                          aria-label={`Increase ${item.name}`}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center border border-[#E2D6C5] rounded-lg text-[#1A1715] hover:bg-[#FAF6F0] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#8C7E72] hover:text-[#B91C1C] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 pt-4 border-t border-[#E6DACB] flex items-center justify-between">
                <span className="text-sm font-semibold text-[#5C5147]">
                  Total Price
                </span>
                <span className="text-xl font-bold font-mono-tabular text-[#1A1715]">
                  Rs. {totalAmount.toLocaleString()}
                </span>
              </div>

              <form onSubmit={handlePlaceOrder} className="mt-5 space-y-3.5">
                <div>
                  <label
                    htmlFor="customer-name"
                    className="block text-xs font-semibold text-[#4A4139] mb-1"
                  >
                    Full Name *
                  </label>
                  <input
                    id="customer-name"
                    type="text"
                    required
                    maxLength={VALIDATION_LIMITS.CUSTOMER_NAME_MAX}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full min-h-[44px] px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
                  />
                  {customerName.length > 0 && !isNameValid && (
                    <p className="mt-1 text-[11px] text-[#B91C1C]">
                      Enter at least 2 characters.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="customer-whatsapp"
                    className="block text-xs font-semibold text-[#4A4139] mb-1"
                  >
                    WhatsApp Number *
                  </label>
                  <input
                    id="customer-whatsapp"
                    type="tel"
                    required
                    maxLength={VALIDATION_LIMITS.WHATSAPP_MAX}
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="e.g. 9841234567"
                    className="w-full min-h-[44px] px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E]"
                  />
                  {whatsappNumber.length > 0 && !isPhoneValid && (
                    <p className="mt-1 text-[11px] text-[#B91C1C]">
                      Enter a valid 7–20 digit WhatsApp number.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="special-instructions"
                    className="block text-xs font-semibold text-[#4A4139] mb-1"
                  >
                    Special Instructions / Preferences (Optional)
                  </label>
                  <textarea
                    id="special-instructions"
                    rows={2}
                    maxLength={VALIDATION_LIMITS.INSTRUCTIONS_MAX}
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    placeholder="Spice level, no onions, extra achar..."
                    className="w-full px-3 py-2 text-sm bg-[#FAF6F0] border border-[#E2D6C5] rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D1E] resize-none"
                  />
                </div>

                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#B91C1C]">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!isCheckoutReady || submitting}
                  className="w-full min-h-[48px] px-4 py-3 bg-[#D95D1E] text-white text-sm font-semibold rounded-xl hover:bg-[#C24D12] disabled:bg-[#D6C9B8] disabled:text-[#786B5E] disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {submitting
                    ? 'Sending Order...'
                    : isCheckoutReady
                    ? `Place Order · Rs. ${totalAmount.toLocaleString()}`
                    : 'Fill Name, WhatsApp & Add Items'}
                </button>
              </form>
            </div>
          </aside>
        </main>

        {/* Customer Loyalty Stamp Progress Section */}
        <CustomerLoyaltyPanel
          initialWhatsapp={isPhoneValid ? cleanPhone : ''}
        />
      </div>

      {/* Mobile Bottom Sticky Bar */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1A1715]/95 backdrop-blur-md text-[#FAF6F0] px-4 py-2.5 shadow-lg">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-[#D6C9B8]">
                {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} · Table{' '}
                {verifiedTable.tableNumber}
              </p>
              <p className="text-sm font-bold font-mono-tabular text-white">
                Rs. {totalAmount.toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={scrollToCheckout}
              className="min-h-[44px] px-5 py-2.5 bg-[#D95D1E] text-white text-sm font-semibold rounded-xl hover:bg-[#C24D12] transition-colors cursor-pointer whitespace-nowrap"
            >
              Review & Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
