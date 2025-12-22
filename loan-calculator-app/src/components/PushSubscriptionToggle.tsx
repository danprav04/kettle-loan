"use client";

import { useState, useEffect } from 'react';
import { FiBell, FiBellOff, FiLoader } from 'react-icons/fi';
import { subscribeToPushNotifications, unsubscribeFromPushNotifications, getPushSubscription } from '@/lib/push-client';
import { useUser } from '@/components/UserProvider';

export default function PushSubscriptionToggle() {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSupported, setIsSupported] = useState(false);
    const { user } = useUser();

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            getPushSubscription().then(sub => {
                setIsSubscribed(!!sub);
                setIsLoading(false);
            });
        } else {
            setIsLoading(false);
        }
    }, [user]);

    const handleToggle = async () => {
        setIsLoading(true);
        try {
            if (isSubscribed) {
                await unsubscribeFromPushNotifications();
                setIsSubscribed(false);
            } else {
                await subscribeToPushNotifications();
                setIsSubscribed(true);
            }
        } catch (error) {
            console.error('Push toggle failed:', error);
            alert('Failed to update notification settings. Check console for details.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isSupported) return null;

    return (
        <button
            onClick={handleToggle}
            disabled={isLoading}
            className={`flex items-center justify-center w-full p-2 rounded-md transition-colors btn-muted ${isSubscribed ? 'text-primary' : ''}`}
            title={isSubscribed ? "Disable Notifications" : "Enable Notifications"}
        >
            {isLoading ? (
                <FiLoader className="animate-spin" size={16} />
            ) : isSubscribed ? (
                <FiBell size={16} className="me-1.5" />
            ) : (
                <FiBellOff size={16} className="me-1.5" />
            )}
             <span className="font-semibold text-xs">NOTIFICATIONS</span>
        </button>
    );
}