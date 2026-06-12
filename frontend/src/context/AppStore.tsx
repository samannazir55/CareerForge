import React, { createContext, useContext, useState } from 'react';
import type { SubscriptionPlan, Transaction } from '../types';

interface AppStoreValue {
  pointsBalance: number;
  subscriptionPlan: SubscriptionPlan;
  ownedTemplateIds: string[];
  transactions: Transaction[];
  addPoints: (amount: number, label: string) => void;
  spendPoints: (amount: number, label: string) => boolean;
  unlockTemplate: (id: string, cost: number) => boolean;
  upgradePlan: (plan: SubscriptionPlan) => void;
  hasTemplate: (id: string) => boolean;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [pointsBalance, setPointsBalance] = useState(100);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>('basic');
  const [ownedTemplateIds, setOwnedTemplateIds] = useState<string[]>(['modern', 'classic']);
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: 'tx-welcome',
      type: 'earn',
      amount: 100,
      label: 'Welcome Bonus',
      date: new Date(),
    },
  ]);

  const addTx = (type: Transaction['type'], amount: number, label: string) => {
    setTransactions((prev) => [
      { id: `tx-${Date.now()}`, type, amount, label, date: new Date() },
      ...prev,
    ]);
  };

  const addPoints = (amount: number, label: string) => {
    setPointsBalance((p) => p + amount);
    addTx('earn', amount, label);
  };

  const spendPoints = (amount: number, label: string): boolean => {
    if (pointsBalance >= amount) {
      setPointsBalance((p) => p - amount);
      addTx('spend', amount, label);
      return true;
    }
    return false;
  };

  const hasTemplate = (id: string) => ownedTemplateIds.includes(id);

  const unlockTemplate = (id: string, cost: number): boolean => {
    if (hasTemplate(id)) return true;
    if (subscriptionPlan === 'premium' || cost === 0) {
      setOwnedTemplateIds((prev) => [...prev, id]);
      addTx('spend', 0, `Unlocked: ${id} (${cost === 0 ? 'Free' : 'Premium Perk'})`);
      return true;
    }
    if (spendPoints(cost, `Unlocked Template: ${id}`)) {
      setOwnedTemplateIds((prev) => [...prev, id]);
      return true;
    }
    return false;
  };

  const upgradePlan = (plan: SubscriptionPlan) => {
    setSubscriptionPlan(plan);
    if (plan === 'professional') addPoints(500, 'Professional Plan — Monthly Points');
    if (plan === 'premium') addPoints(1000, 'Premium Plan — Monthly Points');
  };

  return (
    <AppStoreContext.Provider
      value={{
        pointsBalance,
        subscriptionPlan,
        ownedTemplateIds,
        transactions,
        addPoints,
        spendPoints,
        unlockTemplate,
        upgradePlan,
        hasTemplate,
      }}
    >
      {children}
    </AppStoreContext.Provider>
  );
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be used inside AppStoreProvider');
  return ctx;
}
