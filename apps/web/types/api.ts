// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Wallets ──────────────────────────────────────────────────────────────────

export type WalletType = "personal" | "home" | "business" | "family" | "project" | "custom";
export type WalletMemberRole = "owner" | "editor" | "viewer";
export type WalletMemberStatus = "active" | "pending" | "revoked";

export interface WalletListItem {
  id: string;
  name: string;
  type: WalletType;
  currencyCode: string;
  isArchived: boolean;
  role: WalletMemberRole;
  settledBalance: number;
  projectedBalance: number;
  memberCount: number;
  createdAt: string;
}

export interface WalletDetail {
  id: string;
  ownerUserId: string;
  name: string;
  type: WalletType;
  currencyCode: string;
  initialBalance: number;
  description: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  role: WalletMemberRole;
  settledBalance: number;
  projectedBalance: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WalletMember {
  id: string;
  walletId: string;
  userId: string | null;
  role: WalletMemberRole;
  status: WalletMemberStatus;
  invitedEmail: string | null;
  invitedByUserId: string | null;
  invitedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Bank Accounts ────────────────────────────────────────────────────────────

export type BankAccountType = "checking" | "savings" | "investment" | "credit_card" | "cash" | "other";

export interface BankAccount {
  id: string;
  walletId: string;
  name: string;
  type: BankAccountType;
  institution: string | null;
  accountNumber: string | null;
  isArchived: boolean;
  /** Confirmed balance in cents — present in list responses. */
  balanceCents?: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Categories ───────────────────────────────────────────────────────────────

export type CategoryType = "income" | "expense" | "any";

export interface Category {
  id: string;
  walletId: string;
  name: string;
  type: CategoryType;
  color: string | null;
  icon: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export type TransactionType =
  | "income"
  | "expense"
  | "transfer_in"
  | "transfer_out"
  | "credit_card_purchase"
  | "credit_card_refund"
  | "invoice_payment";

export type TransactionStatus = "pending" | "paid" | "canceled";

export interface Transaction {
  id: string;
  walletId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  sign: number;
  description: string | null;
  notes: string | null;
  dueDate: string;
  paidAt: string | null;
  categoryId: string | null;
  bankAccountId: string | null;
  transferGroupId: string | null;
  recurrenceId: string | null;
  recurrenceIndex: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Recurring Transactions ───────────────────────────────────────────────────

export type RecurrenceFrequency = "daily" | "weekly" | "biweekly" | "monthly";
export type RecurringTransactionType = "income" | "expense";

export interface RecurringTransaction {
  id: string;
  walletId: string;
  type: RecurringTransactionType;
  frequency: RecurrenceFrequency;
  description: string;
  amount: number;
  startDate: string;
  endDate: string | null;
  maxOccurrences: number | null;
  categoryId: string | null;
  bankAccountId: string | null;
  notes: string | null;
  isActive: boolean;
  lastGeneratedDate: string | null;
  createdAt: string;
  updatedAt: string;
  upcomingOccurrences?: Transaction[];
}

export interface RecurringTransactionListResponse {
  recurringTransactions: RecurringTransaction[];
  total: number;
}

// ─── Credit Cards ─────────────────────────────────────────────────────────────

export interface CreditCard {
  id: string;
  walletId: string;
  name: string;
  closingDay: number;
  dueDay: number;
  creditLimitCents: number | null;
  usedCreditCents: number | null;
  availableCreditCents: number | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Purchases ────────────────────────────────────────────────────────────────

export interface InstallmentSummary {
  id: string;
  installmentNumber: number;
  amountCents: number;
  faturaId: string;
  faturaClosingDate: string;
  dueDate: string;
  status: "pending" | "paid" | "canceled";
}

export interface CreditCardPurchase {
  id: string;
  cardId: string;
  walletId: string;
  categoryId: string | null;
  description: string;
  totalAmountCents: number;
  installmentCount: number;
  purchaseDate: string;
  notes: string | null;
  status: "active" | "canceled";
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
  installments: InstallmentSummary[];
}

// ─── Faturas ──────────────────────────────────────────────────────────────────

export type FaturaStatus = "open" | "closed" | "overdue" | "paid";

export interface FaturaInstallment {
  id: string;
  purchaseId: string;
  purchaseDescription: string;
  installmentNumber: number;
  totalInstallments: number;
  amountCents: number;
  dueDate: string;
  status: "pending" | "paid" | "canceled";
  categoryId: string | null;
}

export interface Fatura {
  id: string;
  cardId: string;
  walletId: string;
  categoryId: string | null;
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  status: FaturaStatus;
  totalCents: number;
  paidAt: string | null;
  invoicePaymentTxId: string | null;
  cardName?: string;
  createdAt: string;
  updatedAt: string;
  installments?: FaturaInstallment[];
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardFlow {
  income: number;
  expenses: number;
  net: number;
}

export type DashboardView = "confirmed" | "projected";

export interface DashboardPeriodSummary {
  confirmed: DashboardFlow;
  projected: DashboardFlow;
}

export interface DashboardMonthSummary extends DashboardPeriodSummary {
  month: number;
  year: number;
}

export interface DashboardYearSummary extends DashboardPeriodSummary {
  year: number;
}

export interface DashboardCategoryBreakdownItem {
  categoryId: string | null;
  categoryName: string | null;
  totalExpenses: number;
  transactionCount: number;
}

export interface DashboardMonthlyTrendItem {
  month: number;
  year: number;
  confirmed: DashboardFlow;
  projected: DashboardFlow;
}

export interface DashboardCreditCardSummary {
  monthSpendCents: number;
  monthTransactionCount: number;
}

export interface DashboardResponse {
  currentMonth: DashboardMonthSummary;
  currentYear: DashboardYearSummary;
  categoryBreakdown: DashboardCategoryBreakdownItem[];
  monthlyTrend: DashboardMonthlyTrendItem[];
  creditCard: DashboardCreditCardSummary;
}

/** Optional query params for the dashboard endpoint. Format: YYYY-MM */
export interface DashboardQueryParams {
  from?: string;
  to?: string;
}

// ─── List / Paginated Responses ───────────────────────────────────────────────

export interface WalletListResponse {
  wallets: WalletListItem[];
  total: number;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CardListResponse {
  cards: CreditCard[];
  total: number;
}

export interface PurchaseListResponse {
  purchases: CreditCardPurchase[];
  total: number;
}

export interface FaturaListResponse {
  faturas: Fatura[];
  total: number;
}

export interface BankAccountListResponse {
  bankAccounts: BankAccount[];
  total: number;
}

export interface CategoryListResponse {
  categories: Category[];
  total: number;
}

export interface MemberListResponse {
  members: WalletMember[];
  total: number;
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export interface RequestOtpDto {
  email: string;
}

export interface VerifyOtpDto {
  email: string;
  token: string;
}

export interface CreateWalletDto {
  name: string;
  type: WalletType;
  currencyCode?: string;
  initialBalance?: number;
  description?: string;
}

export interface UpdateWalletDto {
  name?: string;
  type?: WalletType;
  description?: string;
}

export interface InviteMemberDto {
  email: string;
  role: "editor" | "viewer";
}

export interface CreateTransactionDto {
  type: TransactionType;
  amount: number;
  description: string;
  dueDate: string;
  status?: "pending" | "paid";
  categoryId?: string;
  bankAccountId?: string;
  paidAt?: string;
  notes?: string;
  counterpartBankAccountId?: string;
}

export interface UpdateTransactionDto {
  description?: string;
  amount?: number;
  dueDate?: string;
  status?: TransactionStatus;
  categoryId?: string | null;
  bankAccountId?: string;
  paidAt?: string;
  notes?: string;
}

export interface CreateRecurringTransactionDto {
  type: RecurringTransactionType;
  frequency: RecurrenceFrequency;
  description: string;
  amount: number;
  startDate: string;
  endDate?: string;
  maxOccurrences?: number;
  categoryId?: string;
  bankAccountId?: string;
  notes?: string;
}

export interface UpdateRecurringTransactionDto {
  description?: string;
  amount?: number;
  endDate?: string;
  maxOccurrences?: number;
  categoryId?: string | null;
  bankAccountId?: string;
  notes?: string;
}

export interface CreateBankAccountDto {
  name: string;
  type: BankAccountType;
  institution?: string;
}

export interface CreateCategoryDto {
  name: string;
  type: CategoryType;
  color?: string;
  icon?: string;
}

export interface CreateCardDto {
  name: string;
  closingDay: number;
  dueDay: number;
  creditLimitCents?: number;
}

export interface UpdateCardDto {
  name?: string;
  closingDay?: number;
  dueDay?: number;
  creditLimitCents?: number | null;
  isArchived?: boolean;
}

export interface CreatePurchaseDto {
  description: string;
  totalAmountCents: number;
  installmentCount: number;
  purchaseDate: string;
  categoryId?: string;
  notes?: string;
}

export interface UpdatePurchaseDto {
  description?: string;
  notes?: string;
  categoryId?: string | null;
}

export interface PayFaturaDto {
  bankAccountId: string;
  paidAt?: string;
}

export interface UpdateFaturaCategoryDto {
  categoryId: string | null;
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export interface Budget {
  id: string;
  walletId: string;
  categoryId: string;
  categoryName: string | null;
  amountCents: number;
  spentCents: number;
  pct: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertBudgetDto {
  amountCents: number;
}
