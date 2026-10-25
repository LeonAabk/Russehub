export type RusseRole = 'admin' | 'economy' | 'dugnad' | 'member';

export interface GroupMember {
  userId: string;
  displayName: string;
  email?: string;
  role: RusseRole;
  roleTitle: string; // e.g. "Bussjef / Leder", "Økonomiansvarlig"
  joinedAt: string;
}

export interface RusseGroup {
  id: string;
  name: string;
  code: string; // e.g. "KRONEN-26"
  creatorId: string;
  creatorName?: string;
  budgetGoal: number;
  schoolOrCity?: string;
  createdAt: string;
  members: GroupMember[];
}

export interface Transaction {
  id?: string;
  groupId?: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  payer?: string;
  notes?: string;
  createdAt?: string;
}

export interface RusseEvent {
  id?: string;
  groupId?: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  category: 'Møte' | 'Dugnad' | 'Rulling' | 'Fest' | 'Slipp' | 'Deadline' | string;
  location?: string;
  notes?: string;
  createdAt?: string;
}

export interface Notice {
  id?: string;
  groupId?: string;
  title: string;
  content: string;
  isPinned: boolean;
  authorName?: string;
  authorId?: string;
  createdAt?: string;
}

export function formatCurrencyNOK(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} kr`;
}

export function calculateBudgetSummary(transactions: Transaction[]) {
  let totalIncome = 0;
  let totalExpense = 0;
  const categoryBreakdown: Record<string, number> = {};

  for (const t of transactions) {
    const val = Number(t.amount) || 0;
    if (t.type === 'income') {
      totalIncome += val;
    } else {
      totalExpense += val;
      const cat = t.category || 'Annet';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + val;
    }
  }

  const balance = totalIncome - totalExpense;
  return {
    totalIncome,
    totalExpense,
    balance,
    categoryBreakdown,
  };
}

export function calculateDugnadProgress(currentBalance: number, targetGoal: number) {
  const goal = targetGoal > 0 ? targetGoal : 1;
  const rawPct = Math.round((currentBalance / goal) * 100);
  const percentage = Math.max(0, Math.min(100, rawPct));
  const remaining = Math.max(0, goal - currentBalance);
  return {
    percentage,
    remaining,
    isTargetReached: currentBalance >= goal,
  };
}

export function getDaysUntil(targetDateStr: string, fromDate = new Date()): number {
  const target = new Date(targetDateStr);
  const d1 = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime();
  const d2 = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const diffTime = d2 - d1;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function sortUpcomingEvents(events: RusseEvent[]): RusseEvent[] {
  return [...events].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
    const dateB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
    return dateA - dateB;
  });
}

export function filterEventsByCategory(events: RusseEvent[], category: string): RusseEvent[] {
  if (!category || category === 'Alle') return events;
  return events.filter((e) => e.category.toLowerCase() === category.toLowerCase());
}

export function sortNotices(notices: Notice[]): Notice[] {
  return [...notices].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

// --- Role & Permissions Logic ---
export function isAdmin(role: RusseRole | string): boolean {
  return role === 'admin' || role === 'Bussjef' || role === 'Administrator';
}

export function canManageMembers(role: RusseRole | string): boolean {
  return isAdmin(role);
}

export function canEditFinances(role: RusseRole | string): boolean {
  return isAdmin(role) || role === 'economy' || role === 'Økonomiansvarlig';
}

export function formatRoleLabel(role: RusseRole | string): string {
  switch (role) {
    case 'admin':
    case 'Bussjef':
    case 'Administrator':
      return 'Bussjef / Administrator';
    case 'economy':
    case 'Økonomiansvarlig':
      return 'Økonomiansvarlig';
    case 'dugnad':
    case 'Dugnadsansvarlig':
      return 'Dugnadsansvarlig';
    default:
      return 'Medlem';
  }
}

// --- Invite Code Helpers ---
export function generateInviteCode(groupName = ''): string {
  const cleanName = groupName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4) || 'RUSS';
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${cleanName}-${randomSuffix}`;
}

export function validateInviteCode(code: string): boolean {
  if (!code) return false;
  const clean = code.trim().toUpperCase();
  return clean.length >= 4 && clean.length <= 16 && /^[A-Z0-9_-]+$/.test(clean);
}

export function filterByGroupId<T extends { groupId?: string }>(items: T[], activeGroupId: string): T[] {
  if (!activeGroupId) return items;
  return items.filter((item) => !item.groupId || item.groupId === activeGroupId);
}
