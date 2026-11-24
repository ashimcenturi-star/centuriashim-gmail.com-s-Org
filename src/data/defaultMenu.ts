export interface SeedCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface SeedMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  sortOrder: number;
}

export interface SeedTable {
  id: string;
  tableNumber: string;
  label: string;
  active: boolean;
}

export const DEFAULT_CATEGORIES: SeedCategory[] = [
  { id: 'cat-biryani', name: 'Biryani', sortOrder: 1 },
  { id: 'cat-sekuwa-grilled', name: 'Sekuwa and Grilled Items', sortOrder: 2 },
  { id: 'cat-grilled-chicken', name: 'Grilled Chicken', sortOrder: 3 },
  { id: 'cat-snacks-starters', name: 'Snacks and Starters', sortOrder: 4 },
  { id: 'cat-drinks', name: 'Drinks', sortOrder: 5 },
  { id: 'cat-chiya-hot', name: 'Chiya and Hot Beverages', sortOrder: 6 },
];

export const DEFAULT_MENU_ITEMS: SeedMenuItem[] = [
  // Biryani
  {
    id: 'item-chicken-dum-biryani',
    name: 'Bhatti Chicken Dum Biryani',
    description: 'Fragrant long-grain basmati rice slow-cooked with spiced chicken, caramelized onions, saffron, and mint raita.',
    price: 380,
    category: 'Biryani',
    available: true,
    sortOrder: 1,
  },
  {
    id: 'item-mutton-biryani',
    name: 'Special Mutton Biryani',
    description: 'Tender bone-in goat slow-simmered in whole Nepali spices, layered with aromatic basmati rice and ghee.',
    price: 490,
    category: 'Biryani',
    available: true,
    sortOrder: 2,
  },
  {
    id: 'item-veg-dum-biryani',
    name: 'Paneer & Veg Dum Biryani',
    description: 'Roasted paneer cubes and seasonal vegetables steamed with saffron basmati rice, cashews, and curd.',
    price: 310,
    category: 'Biryani',
    available: true,
    sortOrder: 3,
  },

  // Sekuwa and Grilled Items
  {
    id: 'item-pork-sekuwa',
    name: 'Charcoal Pork Sekuwa',
    description: 'Smoky wood-fired pork strips marinated in ginger, garlic, timur, and roasted mustard oil with chiura.',
    price: 390,
    category: 'Sekuwa and Grilled Items',
    available: true,
    sortOrder: 1,
  },
  {
    id: 'item-mutton-sekuwa',
    name: 'Bhatti Mutton Sekuwa',
    description: 'Succulent boneless mutton skewers grilled over live charcoal and served with fresh tomato-sesame achar.',
    price: 460,
    category: 'Sekuwa and Grilled Items',
    available: true,
    sortOrder: 2,
  },
  {
    id: 'item-haku-buff-choila',
    name: 'Haku Buff Choila',
    description: 'Fire-charred spiced buffalo meat tossed with roasted chilies, scallions, garlic, and pure mustard oil.',
    price: 320,
    category: 'Sekuwa and Grilled Items',
    available: true,
    sortOrder: 3,
  },

  // Grilled Chicken
  {
    id: 'item-half-grilled-chicken',
    name: 'Half Bhatti Grilled Chicken',
    description: 'Charcoal-roasted half chicken glazed with smoky chili-butter baste, served with mint chutney and salad.',
    price: 480,
    category: 'Grilled Chicken',
    available: true,
    sortOrder: 1,
  },
  {
    id: 'item-chicken-sekuwa-platter',
    name: 'Spiced Chicken Sekuwa',
    description: 'Boneless chicken thigh cubes marinated overnight in yogurt and Nepali herbs, flame-grilled to order.',
    price: 340,
    category: 'Grilled Chicken',
    available: true,
    sortOrder: 2,
  },
  {
    id: 'item-grilled-wings',
    name: 'Smoky Bhatti Chicken Wings',
    description: 'Six char-grilled chicken wings tossed in roasted garlic, Sichuan peppercorn, and honey-chili glaze.',
    price: 330,
    category: 'Grilled Chicken',
    available: true,
    sortOrder: 3,
  },

  // Snacks and Starters
  {
    id: 'item-buff-steam-momo',
    name: 'Buff Steam Momo (10 pcs)',
    description: 'Juicy hand-folded dumplings steamed fresh and served with house roasted sesame-tomato dipping sauce.',
    price: 180,
    category: 'Snacks and Starters',
    available: true,
    sortOrder: 1,
  },
  {
    id: 'item-mustang-aloo',
    name: 'Crispy Mustang Aloo',
    description: 'Golden fried potato wedges tossed with aromatic jimbu, red chilies, spring onions, and lime.',
    price: 210,
    category: 'Snacks and Starters',
    available: true,
    sortOrder: 2,
  },
  {
    id: 'item-sukuti-sadheko',
    name: 'Bhatti Sukuti Sadheko',
    description: 'Crisp pan-tossed dried meat mixed with red onions, green chilies, tomatoes, coriander, and lemon.',
    price: 360,
    category: 'Snacks and Starters',
    available: true,
    sortOrder: 3,
  },
  {
    id: 'item-bhatmas-sadheko',
    name: 'Roasted Bhatmas Sadheko',
    description: 'Crunchy roasted soybeans dressed with diced onions, ginger, fresh chilies, and mustard oil.',
    price: 140,
    category: 'Snacks and Starters',
    available: true,
    sortOrder: 4,
  },

  // Drinks
  {
    id: 'item-fresh-lime-soda',
    name: 'Fresh Lime Soda',
    description: 'Chilled sparkling soda with fresh Kathmandu kagati lime, crushed mint leaves, and Himalayan black salt.',
    price: 95,
    category: 'Drinks',
    available: true,
    sortOrder: 1,
  },
  {
    id: 'item-sweet-dahi-lassi',
    name: 'Creamy Dahi Lassi',
    description: 'Thick whipped yogurt cooler lightly sweetened and topped with crushed pistachios and cardamom.',
    price: 150,
    category: 'Drinks',
    available: true,
    sortOrder: 2,
  },
  {
    id: 'item-mint-mojito',
    name: 'Virgin Mint Mojito',
    description: 'Refreshing muddled mint, lime wedges, cane syrup, and sparkling water served over crushed ice.',
    price: 160,
    category: 'Drinks',
    available: true,
    sortOrder: 3,
  },

  // Chiya and Hot Beverages
  {
    id: 'item-matka-masala-chiya',
    name: 'Matka Masala Chiya',
    description: 'Rich slow-simmered Nepali milk tea brewed with crushed cardamom, fresh ginger, cinnamon, and cloves.',
    price: 60,
    category: 'Chiya and Hot Beverages',
    available: true,
    sortOrder: 1,
  },
  {
    id: 'item-black-ginger-tea',
    name: 'Ilam Black Ginger Tea',
    description: 'Single-origin Ilam orthodox black tea steeped with fresh crushed ginger and lemon.',
    price: 55,
    category: 'Chiya and Hot Beverages',
    available: true,
    sortOrder: 2,
  },
  {
    id: 'item-hot-lemon-honey',
    name: 'Hot Lemon Honey',
    description: 'Soothing warm infusion of fresh kagati lime juice and natural wild mountain honey.',
    price: 110,
    category: 'Chiya and Hot Beverages',
    available: true,
    sortOrder: 3,
  },
];

export const DEFAULT_TABLES: SeedTable[] = Array.from({ length: 8 }, (_, idx) => {
  const num = String(idx + 1).padStart(2, '0');
  return {
    id: num,
    tableNumber: num,
    label: idx < 4 ? 'Main Hall' : idx < 6 ? 'Window Side' : 'Terrace',
    active: true,
  };
});

export const DEFAULT_LOYALTY_SETTINGS = {
  requiredStamps: 10,
  rewardDescription: 'Free Chicken Dum Biryani or Sekuwa Platter',
};
