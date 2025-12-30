import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
    return ctx;
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);

    // MAJ: On ajoute 'action' pour le mode télécommande { screen: '...', id: '...' }
    const addNotification = useCallback((title, message, type = "info", action = null) => {
        const newNotif = {
            id: Date.now(),
            time: "À l'instant",
            title,
            message,
            type,
            read: false,
            action // Stockage de l'action
        };
        setNotifications(prev => [newNotif, ...prev]);
    }, []);

    const markAsRead = useCallback((id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const value = useMemo(() => ({
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