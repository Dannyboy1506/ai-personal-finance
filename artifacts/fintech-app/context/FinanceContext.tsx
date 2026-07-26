import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SEED_CATEGORIES } from '@/constants/categories';
import { parseWithOpenRouter } from '@/services/tier2Service';
import { computeFirstRunDate, getNextRunDate, type RecurringFrequency } from '@/utils/recurringDates';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Account {
  id: string;
  name: string;
  type: 'BANK' | 'CASH' | 'CREDIT_CARD';
  currency: string;
  balance: number;
  isDeleted: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  isRisk: boolean;
  color: string;
  icon: string;
  keywords: string[];
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  goalId?: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  description: string;
  timestamp: string; // ISO-8601
  processedBy: 'ON_DEVICE' | 'OPENROUTER' | 'GEMINI' | 'MANUAL';
  confidence?: number;
  needsConfirmation: boolean;
  isDeleted: boolean;
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // ISO date string
  isDeleted: boolean;
  createdAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  monthlyLimit: number;
  period: 'MONTHLY' | 'WEEKLY';
  rolloverEnabled: boolean;
  createdAt: string;
}

export interface SyncQueueItem {
  id: string;
  rawInput: string;
  targetTier: 'TIER_2' | 'TIER_3';
  status: 'PENDING' | 'FAILED' | 'DONE';
  retryCount: number;
  createdAt: string;
}

export interface RecurringRule {
  id: string;
  description: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  categoryId: string;
  accountId: string;
  frequency: RecurringFrequency;
  dayOfMonth?: number; // 1–28, used when frequency === 'MONTHLY'
  dayOfWeek?: number; // 0 (Sun) – 6 (Sat), used when frequency === 'WEEKLY'
  nextRunDate: string; // ISO date-time of the next auto-log
  isActive: boolean;
  createdAt: string;
}

export type GoalPacing = 'on-track' | 'behind' | 'at-risk';

export type AuditPeriod = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

export interface PeriodSummary {
  period: AuditPeriod;
  totalBalance: number;
  periodIncome: number;
  periodExpenses: number;
  topCategories: Array<{ name: string; amount: number; isRisk: boolean }>;
  activeGoals: Array<{ name: string; progress: number; pacing: GoalPacing }>;
  budgetAlerts: Array<{ category: string; spent: number; limit: number; percentage: number }>;
}

const MAX_RECURRING_CATCHUP = 12; // cap backfilled runs if the app was closed for a long time
const MAX_SYNC_RETRIES = 5;

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEYS = {
  accounts: '@fintech/accounts',
  categories: '@fintech/categories',
  transactions: '@fintech/transactions',
  goals: '@fintech/goals',
  budgets: '@fintech/budgets',
  syncQueue: '@fintech/syncQueue',
  recurring: '@fintech/recurring',
  onboarded: '@fintech/onboarded',
};

const EXPORT_SCHEMA_VERSION = 1;

// ─── Context shape ────────────────────────────────────────────────────────────

interface FinanceContextValue {
  isLoading: boolean;
  isOffline: boolean;
  setOffline: (offline: boolean) => void;
  persistError: string | null;
  dismissPersistError: () => void;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  syncQueue: SyncQueueItem[];
  recurringRules: RecurringRule[];
  // Accounts
  addAccount: (data: Omit<Account, 'id' | 'isDeleted' | 'createdAt'>) => Account;
  deleteAccount: (id: string) => void;
  // Transactions
  addTransaction: (data: Omit<Transaction, 'id' | 'isDeleted' | 'createdAt'>) => Transaction;
  confirmTransaction: (id: string, categoryId: string) => void;
  deleteTransaction: (id: string) => void;
  learnKeyword: (keyword: string, categoryId: string) => void;
  // Goals
  addGoal: (data: Omit<Goal, 'id' | 'isDeleted' | 'createdAt'>) => Goal;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  // Budgets
  addBudget: (data: Omit<Budget, 'id' | 'createdAt'>) => Budget;
  deleteBudget: (id: string) => void;
  // Sync queue
  addToSyncQueue: (item: Omit<SyncQueueItem, 'id' | 'createdAt'>) => SyncQueueItem;
  updateSyncItem: (id: string, updates: Partial<SyncQueueItem>) => void;
  drainSyncQueue: () => Promise<void>;
  // Recurring transactions
  addRecurringRule: (
    data: Omit<RecurringRule, 'id' | 'createdAt' | 'nextRunDate' | 'isActive'>,
  ) => RecurringRule;
  deleteRecurringRule: (id: string) => void;
  toggleRecurringRule: (id: string) => void;
  checkRecurringDue: () => void;
  // Backup / restore
  exportAllData: () => Promise<string>;
  importAllData: (json: string) => Promise<{ success: boolean; error?: string }>;
  // Analytics helpers
  getTotalBalance: () => number;
  getMonthlyStats: () => { income: number; expenses: number };
  getBudgetSpent: (categoryId: string) => number;
  getGoalPacing: (goal: Goal) => GoalPacing;
  getPeriodSummary: (period: AuditPeriod) => PeriodSummary;
  getRecentTransactions: (count?: number) => Transaction[];
  getCategoryById: (id: string) => Category | undefined;
  getAccountById: (id: string) => Account | undefined;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

// ─── ID helper ────────────────────────────────────────────────────────────────

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([]);
  const [persistError, setPersistError] = useState<string | null>(null);

  // Persist helper — saves latest state to AsyncStorage.
  // Retries once on failure (covers transient issues); if it still fails, the
  // write is surfaced via `persistError` instead of being silently dropped,
  // since a failed write here means real financial data didn't make it to disk.
  const persistRef = useRef<{ [key: string]: unknown }>({});

  const persist = useCallback(async (key: string, value: unknown) => {
    persistRef.current[key] = value;
    const serialized = JSON.stringify(value);
    try {
      await AsyncStorage.setItem(key, serialized);
      setPersistError(null);
    } catch {
      try {
        await AsyncStorage.setItem(key, serialized);
        setPersistError(null);
      } catch {
        setPersistError('Your last change may not have saved. Check your device storage.');
      }
    }
  }, []);

  const dismissPersistError = useCallback(() => setPersistError(null), []);

  // ── Load on mount ──────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [
          rawAccounts,
          rawCategories,
          rawTransactions,
          rawGoals,
          rawBudgets,
          rawSync,
          rawRecurring,
          rawOnboarded,
        ] = await Promise.all([
          AsyncStorage.getItem(KEYS.accounts),
          AsyncStorage.getItem(KEYS.categories),
          AsyncStorage.getItem(KEYS.transactions),
          AsyncStorage.getItem(KEYS.goals),
          AsyncStorage.getItem(KEYS.budgets),
          AsyncStorage.getItem(KEYS.syncQueue),
          AsyncStorage.getItem(KEYS.recurring),
          AsyncStorage.getItem(KEYS.onboarded),
        ]);

        const isOnboarded = rawOnboarded === 'true';

        if (!isOnboarded) {
          // First launch — seed categories and default account
          const seededCategories: Category[] = SEED_CATEGORIES.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            isRisk: c.isRisk,
            color: c.color,
            icon: c.icon,
            keywords: c.keywords,
          }));
          const defaultAccount: Account = {
            id: genId(),
            name: 'Main Account',
            type: 'BANK',
            currency: 'USD',
            balance: 0,
            isDeleted: false,
            createdAt: new Date().toISOString(),
          };

          setCategories(seededCategories);
          setAccounts([defaultAccount]);

          await Promise.all([
            AsyncStorage.setItem(KEYS.categories, JSON.stringify(seededCategories)),
            AsyncStorage.setItem(KEYS.accounts, JSON.stringify([defaultAccount])),
            AsyncStorage.setItem(KEYS.onboarded, 'true'),
          ]);
        } else {
          if (rawCategories) setCategories(JSON.parse(rawCategories));
          else setCategories(SEED_CATEGORIES.map((c) => ({ ...c })));
          if (rawAccounts) setAccounts(JSON.parse(rawAccounts));
        }

        if (rawTransactions) setTransactions(JSON.parse(rawTransactions));
        if (rawGoals) setGoals(JSON.parse(rawGoals));
        if (rawBudgets) setBudgets(JSON.parse(rawBudgets));
        if (rawSync) setSyncQueue(JSON.parse(rawSync));
        if (rawRecurring) setRecurringRules(JSON.parse(rawRecurring));
      } catch {
        setPersistError('Some saved data could not be loaded. Recent entries may be missing.');
      }

      setIsLoading(false);
    })();
  }, []);

  // ── Accounts ──────────────────────────────────────────────────────────────

  const addAccount = useCallback(
    (data: Omit<Account, 'id' | 'isDeleted' | 'createdAt'>): Account => {
      const account: Account = {
        ...data,
        id: genId(),
        isDeleted: false,
        createdAt: new Date().toISOString(),
      };
      setAccounts((prev) => {
        const next = [...prev, account];
        persist(KEYS.accounts, next);
        return next;
      });
      return account;
    },
    [persist],
  );

  const deleteAccount = useCallback(
    (id: string) => {
      setAccounts((prev) => {
        const next = prev.map((a) => (a.id === id ? { ...a, isDeleted: true } : a));
        persist(KEYS.accounts, next);
        return next;
      });
    },
    [persist],
  );

  // ── Transactions ──────────────────────────────────────────────────────────

  const addTransaction = useCallback(
    (data: Omit<Transaction, 'id' | 'isDeleted' | 'createdAt'>): Transaction => {
      const tx: Transaction = {
        ...data,
        id: genId(),
        isDeleted: false,
        createdAt: new Date().toISOString(),
      };

      // Update account balance
      setAccounts((prev) => {
        const next = prev.map((a) => {
          if (a.id !== tx.accountId) return a;
          const delta = tx.type === 'CREDIT' ? tx.amount : -tx.amount;
          return { ...a, balance: a.balance + delta };
        });
        persist(KEYS.accounts, next);
        return next;
      });

      // Update goal if linked
      if (tx.goalId) {
        setGoals((prev) => {
          const next = prev.map((g) => {
            if (g.id !== tx.goalId) return g;
            return { ...g, currentAmount: g.currentAmount + tx.amount };
          });
          persist(KEYS.goals, next);
          return next;
        });
      }

      setTransactions((prev) => {
        const next = [tx, ...prev];
        persist(KEYS.transactions, next);
        return next;
      });

      return tx;
    },
    [persist],
  );

  const confirmTransaction = useCallback(
    (id: string, categoryId: string) => {
      setTransactions((prev) => {
        const next = prev.map((t) =>
          t.id === id ? { ...t, categoryId, needsConfirmation: false } : t,
        );
        persist(KEYS.transactions, next);
        return next;
      });
    },
    [persist],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      // Reverse balance effect
      const tx = transactions.find((t) => t.id === id);
      if (tx) {
        setAccounts((prev) => {
          const next = prev.map((a) => {
            if (a.id !== tx.accountId) return a;
            const delta = tx.type === 'CREDIT' ? -tx.amount : tx.amount;
            return { ...a, balance: a.balance + delta };
          });
          persist(KEYS.accounts, next);
          return next;
        });
      }

      setTransactions((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, isDeleted: true } : t));
        persist(KEYS.transactions, next);
        return next;
      });
    },
    [persist, transactions],
  );

  const learnKeyword = useCallback(
    (keyword: string, categoryId: string) => {
      setCategories((prev) => {
        const next = prev.map((c) => {
          if (c.id !== categoryId) return c;
          if (c.keywords.includes(keyword.toLowerCase())) return c;
          return { ...c, keywords: [keyword.toLowerCase(), ...c.keywords] };
        });
        persist(KEYS.categories, next);
        return next;
      });
    },
    [persist],
  );

  // ── Goals ─────────────────────────────────────────────────────────────────

  const addGoal = useCallback(
    (data: Omit<Goal, 'id' | 'isDeleted' | 'createdAt'>): Goal => {
      const goal: Goal = {
        ...data,
        id: genId(),
        isDeleted: false,
        createdAt: new Date().toISOString(),
      };
      setGoals((prev) => {
        const next = [...prev, goal];
        persist(KEYS.goals, next);
        return next;
      });
      return goal;
    },
    [persist],
  );

  const updateGoal = useCallback(
    (id: string, updates: Partial<Goal>) => {
      setGoals((prev) => {
        const next = prev.map((g) => (g.id === id ? { ...g, ...updates } : g));
        persist(KEYS.goals, next);
        return next;
      });
    },
    [persist],
  );

  const deleteGoal = useCallback(
    (id: string) => {
      setGoals((prev) => {
        const next = prev.map((g) => (g.id === id ? { ...g, isDeleted: true } : g));
        persist(KEYS.goals, next);
        return next;
      });
    },
    [persist],
  );

  // ── Budgets ───────────────────────────────────────────────────────────────

  const addBudget = useCallback(
    (data: Omit<Budget, 'id' | 'createdAt'>): Budget => {
      const budget: Budget = {
        ...data,
        id: genId(),
        createdAt: new Date().toISOString(),
      };
      setBudgets((prev) => {
        const next = [...prev, budget];
        persist(KEYS.budgets, next);
        return next;
      });
      return budget;
    },
    [persist],
  );

  const deleteBudget = useCallback(
    (id: string) => {
      setBudgets((prev) => {
        const next = prev.filter((b) => b.id !== id);
        persist(KEYS.budgets, next);
        return next;
      });
    },
    [persist],
  );

  // ── Recurring transactions ────────────────────────────────────────────────

  const addRecurringRule = useCallback(
    (data: Omit<RecurringRule, 'id' | 'createdAt' | 'nextRunDate' | 'isActive'>): RecurringRule => {
      const rule: RecurringRule = {
        ...data,
        id: genId(),
        isActive: true,
        nextRunDate: computeFirstRunDate(data.frequency, data.dayOfMonth, data.dayOfWeek).toISOString(),
        createdAt: new Date().toISOString(),
      };
      setRecurringRules((prev) => {
        const next = [...prev, rule];
        persist(KEYS.recurring, next);
        return next;
      });
      return rule;
    },
    [persist],
  );

  const deleteRecurringRule = useCallback(
    (id: string) => {
      setRecurringRules((prev) => {
        const next = prev.filter((r) => r.id !== id);
        persist(KEYS.recurring, next);
        return next;
      });
    },
    [persist],
  );

  const toggleRecurringRule = useCallback(
    (id: string) => {
      setRecurringRules((prev) => {
        const next = prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r));
        persist(KEYS.recurring, next);
        return next;
      });
    },
    [persist],
  );

  /**
   * Materializes any recurring rules whose nextRunDate has passed into real
   * transactions. Safe to call on every app launch/foreground — rules that
   * aren't due yet are untouched. Caps catch-up runs per rule so a rule left
   * untouched for a long time doesn't flood the ledger in one pass.
   */
  const checkRecurringDue = useCallback(() => {
    const now = new Date();

    setRecurringRules((prevRules) => {
      let rulesChanged = false;

      const nextRules = prevRules.map((rule) => {
        if (!rule.isActive) return rule;

        let cursor = new Date(rule.nextRunDate);
        let iterations = 0;

        while (cursor.getTime() <= now.getTime() && iterations < MAX_RECURRING_CATCHUP) {
          const tx: Transaction = {
            id: genId(),
            accountId: rule.accountId,
            categoryId: rule.categoryId,
            amount: rule.amount,
            type: rule.type,
            description: rule.description,
            timestamp: cursor.toISOString(),
            processedBy: 'MANUAL',
            needsConfirmation: false,
            isDeleted: false,
            createdAt: new Date().toISOString(),
          };

          setTransactions((prevTx) => {
            const nextTx = [tx, ...prevTx];
            persist(KEYS.transactions, nextTx);
            return nextTx;
          });

          setAccounts((prevAcc) => {
            const nextAcc = prevAcc.map((a) => {
              if (a.id !== rule.accountId) return a;
              const delta = rule.type === 'CREDIT' ? rule.amount : -rule.amount;
              return { ...a, balance: a.balance + delta };
            });
            persist(KEYS.accounts, nextAcc);
            return nextAcc;
          });

          cursor = getNextRunDate(cursor, rule.frequency, rule.dayOfMonth);
          iterations += 1;
          rulesChanged = true;
        }

        return iterations > 0 ? { ...rule, nextRunDate: cursor.toISOString() } : rule;
      });

      if (rulesChanged) persist(KEYS.recurring, nextRules);
      return rulesChanged ? nextRules : prevRules;
    });
  }, [persist]);

  // Run the recurring due-check once, right after initial load finishes.
  useEffect(() => {
    if (!isLoading) checkRecurringDue();
  }, [isLoading, checkRecurringDue]);

  // ── Sync queue ────────────────────────────────────────────────────────────

  const addToSyncQueue = useCallback(
    (item: Omit<SyncQueueItem, 'id' | 'createdAt'>): SyncQueueItem => {
      const entry: SyncQueueItem = {
        ...item,
        id: genId(),
        createdAt: new Date().toISOString(),
      };
      setSyncQueue((prev) => {
        const next = [...prev, entry];
        persist(KEYS.syncQueue, next);
        return next;
      });
      return entry;
    },
    [persist],
  );

  const updateSyncItem = useCallback(
    (id: string, updates: Partial<SyncQueueItem>) => {
      setSyncQueue((prev) => {
        const next = prev.map((i) => (i.id === id ? { ...i, ...updates } : i));
        persist(KEYS.syncQueue, next);
        return next;
      });
    },
    [persist],
  );

  /**
   * Retries every PENDING (or FAILED-but-under-the-retry-cap) sync queue item
   * through Tier 2. Successful items become real transactions (flagged for
   * confirmation, since the category came from a queued retry, not the user
   * reviewing it live) and are marked DONE. Failures bump retryCount and give
   * up permanently past MAX_SYNC_RETRIES so a persistently-bad item doesn't
   * retry forever.
   */
  const drainSyncQueue = useCallback(async () => {
    const pending = syncQueue.filter(
      (item) => item.status === 'PENDING' || (item.status === 'FAILED' && item.retryCount < MAX_SYNC_RETRIES),
    );
    if (pending.length === 0) return;

    const fallbackAccountId = accounts.find((a) => !a.isDeleted)?.id;
    if (!fallbackAccountId) return;

    for (const item of pending) {
      if (item.targetTier !== 'TIER_2') continue;

      const result = await parseWithOpenRouter(item.rawInput, categories);

      if (result) {
        addTransaction({
          accountId: fallbackAccountId,
          categoryId: result.categoryId,
          amount: result.amount,
          type: result.type,
          description: result.description,
          timestamp: item.createdAt,
          processedBy: 'OPENROUTER',
          confidence: result.confidence,
          needsConfirmation: true,
        });
        updateSyncItem(item.id, { status: 'DONE' });
      } else {
        const retryCount = item.retryCount + 1;
        updateSyncItem(item.id, {
          retryCount,
          status: retryCount >= MAX_SYNC_RETRIES ? 'FAILED' : 'PENDING',
        });
      }
    }
  }, [syncQueue, accounts, categories, addTransaction, updateSyncItem]);

  // ── Backup / restore ──────────────────────────────────────────────────────

  /**
   * Serializes every persisted table into one JSON string, suitable for
   * writing to a file and sharing via the OS share sheet. This is currently
   * the only way to get data off-device, since everything lives in
   * AsyncStorage with no cloud sync.
   */
  const exportAllData = useCallback(async (): Promise<string> => {
    const payload = {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        accounts,
        categories,
        transactions,
        goals,
        budgets,
        recurring: recurringRules,
      },
    };
    return JSON.stringify(payload, null, 2);
  }, [accounts, categories, transactions, goals, budgets, recurringRules]);

  /**
   * Restores state from a JSON string produced by exportAllData. Replaces
   * (does not merge with) current data, since merging two independent id
   * spaces safely isn't possible without a lot more bookkeeping — the
   * caller should warn the user this overwrites what's on-device.
   */
  const importAllData = useCallback(
    async (json: string): Promise<{ success: boolean; error?: string }> => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return { success: false, error: 'That file is not valid JSON.' };
      }

      if (typeof parsed !== 'object' || parsed === null || !('data' in parsed)) {
        return { success: false, error: 'That file doesn\'t look like a Steady-Finance backup.' };
      }

      const data = (parsed as { data?: Record<string, unknown> }).data;
      if (!data || typeof data !== 'object') {
        return { success: false, error: 'Backup file is missing its data section.' };
      }

      const nextAccounts = Array.isArray(data.accounts) ? (data.accounts as Account[]) : [];
      const nextCategories = Array.isArray(data.categories) ? (data.categories as Category[]) : [];
      const nextTransactions = Array.isArray(data.transactions) ? (data.transactions as Transaction[]) : [];
      const nextGoals = Array.isArray(data.goals) ? (data.goals as Goal[]) : [];
      const nextBudgets = Array.isArray(data.budgets) ? (data.budgets as Budget[]) : [];
      const nextRecurring = Array.isArray(data.recurring) ? (data.recurring as RecurringRule[]) : [];

      if (nextAccounts.length === 0 || nextCategories.length === 0) {
        return { success: false, error: 'Backup file is missing accounts or categories.' };
      }

      try {
        setAccounts(nextAccounts);
        setCategories(nextCategories);
        setTransactions(nextTransactions);
        setGoals(nextGoals);
        setBudgets(nextBudgets);
        setRecurringRules(nextRecurring);

        await Promise.all([
          persist(KEYS.accounts, nextAccounts),
          persist(KEYS.categories, nextCategories),
          persist(KEYS.transactions, nextTransactions),
          persist(KEYS.goals, nextGoals),
          persist(KEYS.budgets, nextBudgets),
          persist(KEYS.recurring, nextRecurring),
          AsyncStorage.setItem(KEYS.onboarded, 'true'),
        ]);

        return { success: true };
      } catch {
        return { success: false, error: 'Restore failed while saving to device storage.' };
      }
    },
    [persist],
  );

  // ── Analytics ─────────────────────────────────────────────────────────────

  const getTotalBalance = useCallback(() => {
    return accounts
      .filter((a) => !a.isDeleted)
      .reduce((sum, a) => sum + a.balance, 0);
  }, [accounts]);

  const getMonthlyStats = useCallback(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const active = transactions.filter(
      (t) => !t.isDeleted && t.timestamp >= monthStart,
    );
    const income = active
      .filter((t) => t.type === 'CREDIT')
      .reduce((s, t) => s + t.amount, 0);
    const expenses = active
      .filter((t) => t.type === 'DEBIT')
      .reduce((s, t) => s + t.amount, 0);
    return { income, expenses };
  }, [transactions]);

  const getBudgetSpent = useCallback(
    (categoryId: string) => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      return transactions
        .filter(
          (t) =>
            !t.isDeleted &&
            t.categoryId === categoryId &&
            t.type === 'DEBIT' &&
            t.timestamp >= monthStart,
        )
        .reduce((s, t) => s + t.amount, 0);
    },
    [transactions],
  );

  const getGoalPacing = useCallback((goal: Goal): GoalPacing => {
    const now = new Date();
    const created = new Date(goal.createdAt);
    const target = new Date(goal.targetDate);
    const totalMs = target.getTime() - created.getTime();
    const elapsedMs = now.getTime() - created.getTime();
    const daysRemaining = (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysRemaining <= 0) {
      return goal.currentAmount >= goal.targetAmount ? 'on-track' : 'at-risk';
    }

    if (totalMs <= 0) return 'on-track';

    const progressRatio = goal.currentAmount / goal.targetAmount;
    const timeRatio = elapsedMs / totalMs;

    if (progressRatio >= timeRatio) return 'on-track';
    if (progressRatio >= timeRatio * 0.8) return 'behind';
    return 'at-risk';
  }, []);

  /** Start-of-period boundary for a given audit period, relative to now. */
  const getPeriodStartDate = useCallback((period: AuditPeriod, now: Date): Date => {
    switch (period) {
      case 'WEEKLY': {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return d;
      }
      case 'MONTHLY':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'QUARTERLY': {
        const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
        return new Date(now.getFullYear(), qStartMonth, 1);
      }
      case 'HALF_YEARLY': {
        const hStartMonth = now.getMonth() < 6 ? 0 : 6;
        return new Date(now.getFullYear(), hStartMonth, 1);
      }
      case 'YEARLY':
        return new Date(now.getFullYear(), 0, 1);
    }
  }, []);

  /**
   * Aggregates transactions/goals/budgets over the requested period into the
   * shape Tier 3 (Gemini) expects. Backs the period picker on the Insights
   * screen — Weekly through Yearly all funnel through this one function.
   */
  const getPeriodSummary = useCallback(
    (period: AuditPeriod): PeriodSummary => {
      const now = new Date();
      const start = getPeriodStartDate(period, now).toISOString();
      const active = transactions.filter((t) => !t.isDeleted && t.timestamp >= start);

      const periodIncome = active
        .filter((t) => t.type === 'CREDIT')
        .reduce((s, t) => s + t.amount, 0);
      const periodExpenses = active
        .filter((t) => t.type === 'DEBIT')
        .reduce((s, t) => s + t.amount, 0);

      const catMap: Record<string, number> = {};
      active
        .filter((t) => t.type === 'DEBIT')
        .forEach((t) => {
          catMap[t.categoryId] = (catMap[t.categoryId] ?? 0) + t.amount;
        });

      const topCategories = Object.entries(catMap)
        .map(([categoryId, amount]) => {
          const cat = categories.find((c) => c.id === categoryId);
          return { name: cat?.name ?? 'Unknown', amount, isRisk: cat?.isRisk ?? false };
        })
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      const activeGoals = goals
        .filter((g) => !g.isDeleted)
        .slice(0, 3)
        .map((g) => ({
          name: g.name,
          progress: g.targetAmount > 0 ? g.currentAmount / g.targetAmount : 0,
          pacing: getGoalPacing(g),
        }));

      const budgetAlerts = budgets
        .map((b) => {
          const spent = getBudgetSpent(b.categoryId);
          const cat = categories.find((c) => c.id === b.categoryId);
          return {
            category: cat?.name ?? '',
            spent,
            limit: b.monthlyLimit,
            percentage: b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0,
          };
        })
        .filter((b) => b.percentage >= 70);

      return {
        period,
        totalBalance: getTotalBalance(),
        periodIncome,
        periodExpenses,
        topCategories,
        activeGoals,
        budgetAlerts,
      };
    },
    [transactions, categories, goals, budgets, getPeriodStartDate, getGoalPacing, getBudgetSpent, getTotalBalance],
  );

  const getRecentTransactions = useCallback(
    (count = 10) =>
      transactions.filter((t) => !t.isDeleted).slice(0, count),
    [transactions],
  );

  const getCategoryById = useCallback(
    (id: string) => categories.find((c) => c.id === id),
    [categories],
  );

  const getAccountById = useCallback(
    (id: string) => accounts.find((a) => a.id === id),
    [accounts],
  );

  const setOffline = useCallback((offline: boolean) => {
    setIsOffline(offline);
  }, []);

  return (
    <FinanceContext.Provider
      value={{
        isLoading,
        isOffline,
        setOffline,
        persistError,
        dismissPersistError,
        accounts,
        categories,
        transactions,
        goals,
        budgets,
        syncQueue,
        recurringRules,
        addAccount,
        deleteAccount,
        addTransaction,
        confirmTransaction,
        deleteTransaction,
        learnKeyword,
        addGoal,
        updateGoal,
        deleteGoal,
        addBudget,
        deleteBudget,
        addToSyncQueue,
        updateSyncItem,
        drainSyncQueue,
        addRecurringRule,
        deleteRecurringRule,
        toggleRecurringRule,
        checkRecurringDue,
        exportAllData,
        importAllData,
        getTotalBalance,
        getMonthlyStats,
        getBudgetSpent,
        getGoalPacing,
        getPeriodSummary,
        getRecentTransactions,
        getCategoryById,
        getAccountById,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
