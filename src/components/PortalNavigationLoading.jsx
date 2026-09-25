import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './PortalNavigationLoading.css';

const NAVIGATION_LOADING_DURATION_MS = 350;

const getRouteKey = (location) => `${location.pathname}${location.search}${location.hash}`;

export default function PortalNavigationLoading({ children }) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [waitingForRenderedKey, setWaitingForRenderedKey] = useState(null);
  const currentKey = getRouteKey(location);
  const displayKey = getRouteKey(displayLocation);
  const routeChanged = currentKey !== displayKey;
  const isNavigating = routeChanged || waitingForRenderedKey === displayKey;

  useEffect(() => {
    if (!routeChanged) return undefined;

    const requestedLocation = location;
    const timer = window.setTimeout(() => {
      setDisplayLocation(requestedLocation);
      setWaitingForRenderedKey(getRouteKey(requestedLocation));
    }, NAVIGATION_LOADING_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [location, routeChanged]);

  const markLocationRendered = useCallback((renderedKey) => {
    setWaitingForRenderedKey((pendingKey) => (
      pendingKey === renderedKey ? null : pendingKey
    ));
  }, []);

  return (
    <>
      {children({ displayLocation, isNavigating, markLocationRendered })}
      {isNavigating && (
        <div className="portal-navigation-loading-overlay" role="status" aria-live="polite" aria-label="Loading page">
          <div className="splash-loading">
            <span className="splash-loading-text">Loading</span>
            <div className="splash-loader-track">
              <div className="splash-loader-bar" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function PortalNavigationReady({ locationKey, onReady, children }) {
  useEffect(() => {
    onReady(locationKey);
  }, [locationKey, onReady]);

  return children;
}