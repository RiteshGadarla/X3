/**
 * Axios API client — points to FastAPI backend via VITE_API_BASE_URL
 * Automatically injects JWT Authorization header from localStorage.
 */
import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Request interceptor — inject token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('csagent_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor — handle 401
client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('csagent_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
