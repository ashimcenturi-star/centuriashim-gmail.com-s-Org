# Security Specification — Modern Bhatti QR Ordering System

## 1. Data Invariants
1. **Default Deny**: All unspecified paths are denied (`match /{document=**} { allow read, write: if false; }`).
2. **Server-Side Table & Price Integrity**:
   - Customer order creation validates `tableNumber` directly against `/tables/{tableNumber}` (`active == true`) on the Firestore server. Fake or inactive table numbers are rejected.
   - Customer order creation validates every ordered item (`items[0..6]`) against `/menu_items/{itemId}` (`available == true`, exact `price`, exact `name`) and verifies `totalAmount` equals the exact sum of `price * quantity` on the Firestore server. Price or total tampering is mathematically rejected.
3. **PII Isolation**: Customer `orders` contain PII (`customerName`, `whatsappNumber`, `specialInstructions`). Only verified admins (`isBootstrappedAdmin()`) may `get` or `list` `/orders/{orderId}`. Customers track live progress solely via `/order_status/{orderId}`, which stores zero PII and disallows `list` queries (`allow list: if false;`).
4. **Atomic Mirroring**: Creating `/orders/{orderId}` requires `/order_status/{orderId}` to exist in the same atomic batch (`getAfter`), and vice versa (`existsAfter`), with identical `orderNumber`, `tableNumber`, and `status == 'New'`.
5. **Menu, Category & Table Integrity**: Public customers can read `menu_items`, `categories`, and `tables`, but only verified admins (`email_verified == true`) can create, update, or delete them.
6. **Immutable Order Details**: After order creation, admins may only transition `status` and `updatedAt` (`affectedKeys().hasOnly(['status', 'updatedAt'])`), while `orderNumber`, `tableNumber`, `customerName`, `whatsappNumber`, `items`, `totalAmount`, and `createdAt` remain immutable.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Fake Table Injection**: `create /orders/{orderId}` with `tableNumber: "99"` when `/tables/99` does not exist or is inactive -> DENIED.
2. **Order Total Tampering**: `create /orders/{orderId}` with `totalAmount: 1` for a Rs. 320 dish -> DENIED.
3. **Item Price Tampering**: `create /orders/{orderId}` with `items[0].price: 1` instead of catalog price `320` -> DENIED.
4. **Unavailable Dish Ordering**: `create /orders/{orderId}` referencing a `menu_items` doc with `available: false` -> DENIED.
5. **Unauthenticated Order List Scraping**: `list /orders` without admin auth -> DENIED.
6. **Non-Admin Authenticated Order Read**: `get /orders/{orderId}` signed in as non-admin user -> DENIED.
7. **Unverified Admin Email Spoof**: `list /orders` with admin email claim where `email_verified == false` -> DENIED.
8. **Order Shadow Field Injection**: `create /orders/{orderId}` including ghost field `isPaid: true` -> DENIED (`hasOnly` check).
9. **Order Status Shortcut on Create**: `create /orders/{orderId}` with `status: "Completed"` instead of `"New"` -> DENIED.
10. **Unlinked Order Creation (Bypassing Atomic Status)**: `create /orders/{orderId}` without creating `/order_status/{orderId}` in same batch -> DENIED (`getAfter`).
11. **Public Menu Tampering**: Unauthenticated or non-admin `create/update/delete` on `/menu_items/{itemId}` -> DENIED.
12. **Public Order Status Enumeration**: `list /order_status` -> DENIED (`allow list: if false`).
