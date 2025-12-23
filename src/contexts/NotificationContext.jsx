import React, { createContext, useContext, useState, useEffect } from 'react';

const NotificationContext = createContext();

export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
    return ctx;
};

export const NotificationProvider = ({ children }) => {
    // Initial state could be empty or fetched from local storage/API
    const [notifications, setNotifications] = useState([]);

    const addNotification = React.useCallback((title, message, type = "info", targetLink = null) => {
        const newNotif = {
            id: Date.now(),
            user: "Système", // Default sender if not specified
            avatar: "SYS",
            action: title,
            target: message,
            time: "À l'instant",
            read: false,
            type,
            targetLink
        };
        setNotifications(prev => [newNotif, ...prev]);
    }, []);

    const markAsRead = React.useCallback((id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, []);

    const markAllAsRead = React.useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const value = React.useMemo(() => ({
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead
    }), [notifications, unreadCount, addNotification, markAsRead, markAllAsRead]);

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};
