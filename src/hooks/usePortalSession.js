import { createElement, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../services/api';

const usePortalSession = (allowedRoles, portalName) => {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState(false);
  const allowedRolesKey = allowedRoles.map((role) => role.toLowerCase()).join('|');

  useEffect(() => {
    let active = true;
    let checkSequence = 0;
    let refreshTimer;
    const roles = allowedRolesKey.split('|');

    const verifySession = async (force = false) => {
      const checkId = ++checkSequence;
      setAuthError(false);
      try {
        const currentUser = await api.getCurrentUser({ force });
        if (!active || checkId !== checkSequence) return;

        if (!roles.includes(String(currentUser?.role || '').toLowerCase())) {
          setAuthReady(false);
          setUser(null);
          navigate('/login', { replace: true });
          return;
        }

        setUser(currentUser);
        setAuthReady(true);
      } catch (error) {
        if (!active || checkId !== checkSequence) return;
        console.warn(`[AUTH] ${portalName} session check failed`, {
          status: error?.status,
          code: error?.code,
        });
        if (error?.status === 401) {
          setAuthReady(false);
          setUser(null);
          navigate('/login', { replace: true });
        } else {
          setAuthReady(false);
          setAuthError(true);
        }
      }
    };

    const handleStorageChange = (event) => {
      if (event.key !== 'role' && event.key !== 'user') return;
      checkSequence += 1;
      setAuthReady(false);
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void verifySession(true);
      }, 25);
    };

    void verifySession();
    window.addEventListener('storage', handleStorageChange);

    return () => {
      active = false;
      checkSequence += 1;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [allowedRolesKey, navigate, portalName]);

  return { authReady, user, authError };
};

export const PortalSessionError = () => createElement(
  'div',
  {
    role: 'alert',
    style: {
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      padding: '24px',
      color: '#6b0000',
      textAlign: 'center',
    },
  },
  createElement(
    'p',
    null,
    'Unable to verify your session. Your session has not been cleared. Please reload or try again later.'
  )
);

export default usePortalSession;