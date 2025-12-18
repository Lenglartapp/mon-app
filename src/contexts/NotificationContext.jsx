import React, { createContext, useContext, useState, useEffect } from 'react';

const NotificationContext = createContext();

export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
    return ctx;
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([
        { id: 1, user: "Thomas BONNET", avatar: "", action: "vous a assigné sur le projet", target: "Chantier Dupont", time: "Il y a 10 min", read: false },
        { id: 2, user: "Pauline DURAND", avatar: "", action: "a ajouté un commentaire sur", target: "Rideaux Salon", time: "Il y a 2h", read: false },
        { id: 3, user: "Système", avatar: "SYS", action: "Le BPF du projet Villa Sud est validé", target: "", time: "Hier", read: true },
        { id: 4, user: "Atelier", avatar: "PROD", action: "a terminé la fabrication de", target: "Store Banne", time: "Il y a 2 jours", read: true }
    ]);

    const addNotification = (notif) => {
        const newNotif = {
            id: Date.now(),
            time: "À l'instant",
            read: false,
            ...notif
        };
        setNotifications(prev => [newNotif, ...prev]);
    };

    const markAsRead = (id) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead }}>
            {children}
        </NotificationContext.Provider>
    );
};
