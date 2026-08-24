import { createContext, useContext, useEffect, useMemo, useState } from "react";
import "./NotificationProvider.css";

const NotificationContext = createContext(null);

export default function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!notifications.length) return;

    const timers = notifications.map((notification) =>
      setTimeout(() => {
        setNotifications((current) => current.filter((item) => item.id !== notification.id));
      }, notification.duration || 3000)
    );

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [notifications]);

  const notify = (type, title, message, duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setNotifications((current) => [
      ...current,
      { id, type, title, message, duration },
    ]);
  };

  const value = useMemo(() => ({ notify }), []);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="notification-container">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`notification-card notification-${notification.type}`}
          >
            <div className="notification-title">{notification.title}</div>
            <div className="notification-message">{notification.message}</div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
