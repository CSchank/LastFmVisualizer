import { useState } from 'react'

const ACCOUNTS_KEY = 'lastfm_accounts'
const ACTIVE_KEY = 'lastfm_active_account'

function loadAccounts(): string[] {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]') } catch { return [] }
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<string[]>(loadAccounts)
  const [activeAccount, setActiveAccount] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_KEY)
  )

  const addAccount = (username: string) => {
    const updated = [...new Set([...accounts, username])]
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated))
    localStorage.setItem(ACTIVE_KEY, username)
    setAccounts(updated)
    setActiveAccount(username)
  }

  const switchAccount = (username: string) => {
    localStorage.setItem(ACTIVE_KEY, username)
    setActiveAccount(username)
  }

  const removeAccount = (username: string) => {
    const updated = accounts.filter(a => a !== username)
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated))
    setAccounts(updated)
    if (activeAccount === username) {
      const next = updated[0] ?? null
      if (next) localStorage.setItem(ACTIVE_KEY, next)
      else localStorage.removeItem(ACTIVE_KEY)
      setActiveAccount(next)
    }
  }

  return { accounts, activeAccount, addAccount, switchAccount, removeAccount }
}
