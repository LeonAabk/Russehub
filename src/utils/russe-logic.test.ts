import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCurrencyNOK,
  calculateBudgetSummary,
  calculateDugnadProgress,
  getDaysUntil,
  sortUpcomingEvents,
  filterEventsByCategory,
  sortNotices,
  isAdmin,
  canManageMembers,
  canEditFinances,
  generateInviteCode,
  validateInviteCode,
  filterByGroupId,
  Transaction,
  RusseEvent,
  Notice,
} from './russe-logic.ts';

test('formatCurrencyNOK formats correctly', () => {
  assert.equal(formatCurrencyNOK(0), '0 kr');
  assert.equal(formatCurrencyNOK(1500), '1 500 kr');
  assert.equal(formatCurrencyNOK(250000), '250 000 kr');
});

test('calculateBudgetSummary computes income, expense, balance and breakdown', () => {
  const transactions: Transaction[] = [
    { title: 'Dugnad doruller', amount: 50000, type: 'income', category: 'Dugnad', date: '2026-05-01' },
    { title: 'Sponsor Sparebank', amount: 20000, type: 'income', category: 'Sponsor', date: '2026-05-02' },
    { title: 'Buss depositum', amount: 35000, type: 'expense', category: 'Buss/Van', date: '2026-05-03' },
  ];

  const summary = calculateBudgetSummary(transactions);
  assert.equal(summary.totalIncome, 70000);
  assert.equal(summary.totalExpense, 35000);
  assert.equal(summary.balance, 35000);
});

test('role and permission functions evaluate privileges', () => {
  assert.equal(isAdmin('admin'), true);
  assert.equal(isAdmin('Bussjef'), true);
  assert.equal(isAdmin('member'), false);

  assert.equal(canManageMembers('admin'), true);
  assert.equal(canManageMembers('member'), false);

  assert.equal(canEditFinances('admin'), true);
  assert.equal(canEditFinances('Økonomiansvarlig'), true);
  assert.equal(canEditFinances('member'), false);
});

test('generateInviteCode creates valid uppercase group code', () => {
  const code1 = generateInviteCode('Kronen 2026');
  assert.match(code1, /^KRON-[0-9]{4}$/);

  const code2 = generateInviteCode('');
  assert.match(code2, /^RUSS-[0-9]{4}$/);
});

test('validateInviteCode validates code formats', () => {
  assert.equal(validateInviteCode('KRON-2026'), true);
  assert.equal(validateInviteCode('RT99'), true);
  assert.equal(validateInviteCode(''), false);
  assert.equal(validateInviteCode('A'), false);
  assert.equal(validateInviteCode('Code with spaces!'), false);
});

test('filterByGroupId filters items for given active group', () => {
  const items = [
    { id: '1', groupId: 'group-a', title: 'A' },
    { id: '2', groupId: 'group-b', title: 'B' },
    { id: '3', title: 'Shared default' },
  ];

  const filteredA = filterByGroupId(items, 'group-a');
  assert.equal(filteredA.length, 2); // 'group-a' and item with no groupId
  assert.equal(filteredA.some((i) => i.id === '2'), false);
});
