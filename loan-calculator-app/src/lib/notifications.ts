import webPush from 'web-push';
import { db } from './db';

// Hardcoded Public Key (Must match client)
const VAPID_PUBLIC_KEY = "BBP2WoLz_uq0qyfcoEbthsSzzCWYww-CLJ-WVtaIe6x7SK3KcPOK6ZQ9pIQEDjSNoaC2uza_iuFNSieql3h-sTA";

// Private Key must come from Env
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@danprav.me';

// Safe initialization to prevent server crashes (500 Error)
let isPushConfigured = false;
try {
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        webPush.setVapidDetails(
            VAPID_SUBJECT,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        );
        isPushConfigured = true;
    } else {
        console.warn("Push Notifications disabled: Missing VAPID_PRIVATE_KEY in server environment.");
    }
} catch (e) {
    console.error("Failed to initialize web-push:", e);
}

interface NotificationPayload {
    title: string;
    body: string;
    url?: string;
}

export async function sendRoomNotification(roomId: number | string, excludeUserId: number, payload: NotificationPayload) {
    if (!isPushConfigured) {
        return;
    }

    try {
        const result = await db.query(
            `SELECT ps.endpoint, ps.p256dh, ps.auth 
             FROM push_subscriptions ps
             JOIN room_members rm ON ps.user_id = rm.user_id
             WHERE rm.room_id = $1 AND ps.user_id != $2`,
            [roomId, excludeUserId]
        );

        const subscriptions = result.rows;

        const promises = subscriptions.map(sub => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            return webPush.sendNotification(pushSubscription, JSON.stringify(payload))
                .catch(err => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        console.log(`Deleting expired subscription for endpoint: ${sub.endpoint}`);
                        return db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
                    }
                    console.error('Error sending push notification:', err);
                });
        });

        await Promise.all(promises);
    } catch (error) {
        console.error('Failed to send room notifications:', error);
    }
}