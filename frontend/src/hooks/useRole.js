import { useLocation } from 'react-router-dom'

const PATH_TO_ROLE = {
  '/admin':   'Admin',
  '/manager': 'Manager',
  '/agent':   'Support Agent',
  '/vp':      'VP Customer Success',
  '/legal':   'Legal',
}

const ROLE_META = {
  'Admin':               { title: 'System Administrator',      initials: 'AD', color: '#6366f1' },
  'Manager':             { title: 'CS Manager',                initials: 'MG', color: '#0ea5e9' },
  'Support Agent':       { title: 'Support Agent',             initials: 'SA', color: '#10b981' },
  'VP Customer Success': { title: 'VP Customer Success',       initials: 'VP', color: '#f59e0b' },
  'Legal':               { title: 'Legal Team',                initials: 'LG', color: '#8b5cf6' },
}

export function useRole() {
  const { pathname } = useLocation()
  const segment = '/' + (pathname.split('/')[1] || '')
  const role    = PATH_TO_ROLE[segment] || null
  const meta    = role ? ROLE_META[role] : null
  return {
    role,
    title:    meta?.title    || role || 'Guest',
    initials: meta?.initials || '?',
    color:    meta?.color    || 'var(--primary)',
    basePath: segment,
  }
}
