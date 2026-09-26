import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

/**
 * Custom hook to access authentication state and actions
 * @returns {{
 *   user: { id: string, name: string, email: string } | null,
 *   loading: boolean,
 *   authError: string | null,
 *   isAuthenticated: boolean,
 *   login: (email: string, password: string) => Promise<any>,
 *   register: (name: string, email: string, password: string) => Promise<any>,
 *   logout: () => void,
 *   rehydrate: () => Promise<void>
 * }}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;
