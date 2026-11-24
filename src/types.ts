import { Timestamp } from 'firebase/firestore';

export type OrderStatusValue =
  | 'New'
  | 'Accepted'
  | 'Preparing'
  | 'Ready'
  | 'Completed'
  | 'Cancelled';

export const ORDER_STATUS_LIST: OrderStatusValue[] = [
  'New',
  'Accepted',
  'Preparing',
  'Ready',
  'Completed',
  'Cancelled',
];

export const ADMIN_EMAIL = 'ashimcenturi@gmail.com';

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const VALIDATION_LIMITS = {
  NAME_MAX: 100,
  DESCRIPTION_MAX: 400,
  CATEGORY_MAX: 60,
  IMAGE_URL_MAX: 500,
  PRICE_MAX: 100000,
  TABLE_NUMBER_MAX: 20,
  TABLE_NUMBER_REGEX: /^[a-zA-Z0-9\-]+$/,
  TABLE_LABEL_MAX: 60,
  CUSTOMER_NAME_MAX: 80,
  WHATSAPP_MIN: 7,
  WHATSAPP_MAX: 20,
  WHATSAPP_REGEX: /^[0-9+\-() ]{7,20}$/,
  PHONE_KEY_REGEX: /^[0-9]{7,15}$/,
  INSTRUCTIONS_MAX: 300,
  ORDER_ITEMS_MAX: 7,
  ORDER_NUMBER_REGEX: /^MB-[A-Z0-9\-]+$/,
  TOTAL_MAX: 500000,
  REQUIRED_STAMPS_MIN: 1,
  REQUIRED_STAMPS_MAX: 50,
  REWARD_DESCRIPTION_MAX: 200,
  LEDGER_NOTE_MAX: 200,
} as const;

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  imageUrl?: string;
  sortOrder?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  createdAt?: Timestamp;
}

export interface RestaurantTable {
  id: string;
  tableNumber: string;
  label?: string;
  active: boolean;
  createdAt?: Timestamp;
}

export interface OrderItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  tableNumber: string;
  customerName: string;
  whatsappNumber: string;
  specialInstructions: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatusValue;
  stampAwarded?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface OrderStatusDoc {
  id: string;
  orderNumber: string;
  tableNumber: string;
  status: OrderStatusValue;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface LoyaltySettings {
  requiredStamps: number;
  rewardDescription: string;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export interface LoyaltyAccount {
  id: string;
  phoneKey: string;
  phoneHash: string;
  whatsappNumber: string;
  customerName: string;
  stampsCount: number;
  totalStampsEarned: number;
  rewardsRedeemed: number;
  lastAwardedBy: string;
  lastAwardedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface LoyaltyPublicProgress {
  stampsCount: number;
  totalStampsEarned: number;
  rewardsRedeemed: number;
  updatedAt?: Timestamp;
}

export type LoyaltyLedgerType = 'order_award' | 'manual_add' | 'reward_redeem';

export interface LoyaltyLedgerEntry {
  id: string;
  phoneKey: string;
  customerName: string;
  type: LoyaltyLedgerType;
  delta: number;
  orderId: string;
  orderNumber: string;
  note: string;
  awardedBy: string;
  awardedAt?: Timestamp;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
}
