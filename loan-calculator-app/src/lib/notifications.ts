import webPush from 'web-push';
import { db } from './db';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webPush.setVapidDetails(
        VAPID_SUBJECT,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );
}

interface NotificationPayload {
    title: string;
    body: string;
    url?: string;
}

export async function sendRoomNotification(roomId: number | string, excludeUserId: number, payload: NotificationPayload) {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.warn("VAPID keys are not set. Skipping notification.");
        return;
    }

    try {
        // Fetch subscriptions for all members of the room EXCEPT the one who triggered the action
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
                        // Subscription has expired or is invalid, delete it from DB
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