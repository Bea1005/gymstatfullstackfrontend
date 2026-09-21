import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './PortalNavigationLoading.css';

const NAVIGATION_LOADING_DURATION = 3000;
const PORTAL_PATHS = ['/admin', '/student', '/coach', '/screener'];

const getLocationId = (location) => `${location.pathname}${location.search}${location.hash}`;

const isPortalPath = (pathname) => PORTAL_PATHS.some((portalPath) => (
  pathname === portalPath || pathname.startsWith(`${portalPath}/`)
));

const isPortalIndexPath = (pathname) => PORTAL_PATHS.includes(pathname);

const PortalNavigationLoading = ({ children }) => {
  const location = useLocation();
  const locationId = getLocationId(location);
  const timerRef = useRef(null);
  const pendingLocationRef = useRef(location);
  const [displayLocation, setDisplayLocation] = useState(location);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const displayedLocationId = getLocationId(displayLocation);

    if (locationId === displayedLocationId) {
      return undefined;
    }

    if (
      !isPortalPath(location.pathname)
      || !isPortalPath(displayLocation.pathname)
      || isPortalIndexPath(displayLocation.pathname)
    ) {
      setDisplayLocation(location);
      setIsLoading(false);
      return undefined;
    }

    pendingLocationRef.current = location;
    setIsLoading(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setDisplayLocation(pendingLocationRef.current);
      setIsLoading(false);
      timerRef.current = null;
    }, NAVIGATION_LOADING_DURATION);

    return () => window.clearTimeout(timerRef.current);
  }, [displayLocation, location, locationId]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return (
    <>
      {children(displayLocation)}
      {isLoading && (
        <div
          className="portal-navigation-loading"
          role="status"
          aria-live="polite"
          aria-label="Loading destination page"
        >
          <div className="portal-navigation-spinner" />
        </div>
      )}
    </>
  );
};

export default PortalNavigationLoading;