export interface CategoryDef {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  isRisk: boolean;
  color: string;
  icon: string; // Feather icon name
  keywords: string[];
}

export const SEED_CATEGORIES: CategoryDef[] = [
  {
    id: 'cat_income',
    name: 'Money In',
    type: 'INCOME',
    isRisk: false,
    color: '#10B981',
    icon: 'arrow-down-circle',
    keywords: [
      'salary', 'wages', 'income', 'received', 'credit alert', 'deposit',
      'transfer in', 'refund', 'reimbursement', 'got paid', 'payment received',
      'bonus', 'freelance', 'invoice paid', 'cashback',
    ],
  },
  {
    id: 'cat_transport',
    name: 'Transport',
    type: 'EXPENSE',
    isRisk: false,
    color: '#3B82F6',
    icon: 'navigation',
    keywords: [
      'uber', 'bolt', 'taxi', 'fuel', 'petrol', 'diesel', 'bus', 'train',
      'lyft', 'ride', 'transport', 'fare', 'driving', 'park', 'parking',
      'vehicle', 'auto', 'commute', 'flight', 'airline', 'airport',
    ],
  },
  {
    id: 'cat_betting',
    name: 'Betting & Gambling',
    type: 'EXPENSE',
    isRisk: true,
    color: '#F59E0B',
    icon: 'alert-triangle',
    keywords: [
      'bet9ja', 'sportybet', 'betway', 'stake', 'lottery', 'casino',
      'gambling', 'bet', 'wager', '1xbet', 'nairabet', 'parimatch',
      'poker', 'slots', 'jackpot', 'raffle',
    ],
  },
  {
    id: 'cat_food',
    name: 'Groceries & Food',
    type: 'EXPENSE',
    isRisk: false,
    color: '#8B5CF6',
    icon: 'shopping-bag',
    keywords: [
      'kfc', 'mcdonalds', 'shoprite', 'chicken republic', 'mr biggs',
      'tastee', 'food', 'groceries', 'supermarket', 'restaurant', 'dinner',
      'lunch', 'breakfast', 'pizza', 'burger', 'eatery', 'canteen',
      'market', 'provision', 'snack', 'coffee', 'drinks',
    ],
  },
  {
    id: 'cat_bills',
    name: 'Bills & Utilities',
    type: 'EXPENSE',
    isRisk: false,
    color: '#EF4444',
    icon: 'zap',
    keywords: [
      'airtel', 'mtn', 'glo', '9mobile', 'dstv', 'gotv', 'electricity',
      'nepa', 'phcn', 'eko', 'ikeja electric', 'data', 'airtime', 'internet',
      'wifi', 'cable', 'water', 'gas', 'rent', 'landlord', 'subscription',
      'netflix', 'spotify', 'apple', 'google play',
    ],
  },
  {
    id: 'cat_shopping',
    name: 'Shopping & Lifestyle',
    type: 'EXPENSE',
    isRisk: false,
    color: '#EC4899',
    icon: 'shopping-cart',
    keywords: [
      'amazon', 'jumia', 'konga', 'clothes', 'fashion', 'shopping', 'tech',
      'gadget', 'phone', 'laptop', 'electronics', 'beauty', 'cosmetics',
      'haircut', 'salon', 'spa', 'gym', 'fitness',
    ],
  },
  {
    id: 'cat_bankfees',
    name: 'Bank Fees',
    type: 'EXPENSE',
    isRisk: false,
    color: '#DC2626',
    icon: 'credit-card',
    keywords: [
      'charge', 'commission', 'transfer fee', 'maintenance fee',
      'stamp duty', 'vat charge', 'bank fee', 'atm charge', 'sms alert',
    ],
  },
  {
    id: 'cat_general',
    name: 'General Expenses',
    type: 'EXPENSE',
    isRisk: false,
    color: '#6B7280',
    icon: 'circle',
    keywords: [],
  },
];
