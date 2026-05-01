/**
 * Axios API client — points to FastAPI backend via VITE_API_BASE_URL.
 * Injects X-Role header derived from the URL prefix (no JWT / no login).
 * The frontend is mounted under /luka-aegis-fe, so the role segment
 * is the *second* path part, not the first.
 *   /luka-aegis-fe/admin   → X-Role: Admin
 *   /luka-aegis-fe/manager → X-Role: Manager
 *   /luka-aegis-fe/agent   → X-Role: Support Agent
 *   /luka-aegis-fe/vp      → X-Role: VP Customer Success
 *   /luka-aegis-fe/legal   → X-Role: Legal
 */
import axios from 'axios'

const FE_BASENAME = 'luka-aegis-fe'

const PATH_TO_ROLE = {
  '/admin':   'Admin',
  '/manager': 'Manager',
  '/agent':   'Support Agent',
  '/vp':      'VP Customer Success',
  '/legal':   'Legal',
}

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/luka-aegis/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

client.interceptors.request.use((config) => {
  const parts = window.location.pathname.split('/').filter(Boolean)
  const roleSeg = parts[0] === FE_BASENAME ? parts[1] : parts[0]
  const role = PATH_TO_ROLE['/' + (roleSeg || '')]
  if (role) config.headers['X-Role'] = role
  return config
})

export default client
