import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../auth';

const NotificationContext = createContext();

export const useNotifications = () => {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
    return ctx;
};

export const NotificationProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState([]);

    // 1. CHARGEMENT INITIAL
    useEffect(() => {
        if (!currentUser) return;

        const fetchNotifications = async () => {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', currentUser.id) // Seulement mes notifs
                .order('created_at', { ascending: false })
                .limit(50); // On limite aux 50 dernières pour pas surcharger

            if (data) setNotifications(data);
        };

        fetchNotifications();

        // 2. TEMPS RÉEL (Magic !) 🧙‍♂️
        // On écoute si une nouvelle ligne est insérée pour MOI
        const subscription = supabase
            .channel('my-notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${currentUser.id}`
            }, (payload) => {
                setNotifications(prev => [payload.new, ...prev]);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };

    }, [currentUser]);

    // 3. ACTIONS
    const addNotification = useCallback(async (title, message, type = "info", action = null, targetUserId = null) => {
        // Si pas de target, c'est pour moi-même (test) ou diffusion générale (à gérer plus tard)
        const target = targetUserId || currentUser?.id;
        if (!target) return;

        const newNotif = {
            user_id: target,
            title,
            message,
            type,
            read: false,
            action,
            sender_name: currentUser?.name || 'Système'
        };

        // On insère en base (le Realtime mettra à jour l'interface automatiquement !)
        await supabase.from('notifications').insert([newNotif]);
    }, [currentUser]);


    const markAsRead = useCallback(async (id) => {
        // Optimistic UI
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        // DB Update
        await supabase.from('notifications').update({ read: true }).eq('id', id);
    }, []);

    const markAllAsRead = useCallback(async () => {
        // Optimistic UI
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        // DB Update (toutes mes notifs non lues)
        if (currentUser) {
            await supabase.from('notifications')
                .update({ read: true })
                .eq('user_id', currentUser.id)
                .eq('read', false);
        }
    }, [currentUser]);

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