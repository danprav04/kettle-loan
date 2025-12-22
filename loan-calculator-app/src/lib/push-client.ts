// src/lib/push-client.ts

// Hardcoded Public Key (Safe to expose)
const VAPID_PUBLIC_KEY = "BBP2WoLz_uq0qyfcoEbthsSzzCWYww-CLJ-WVtaIe6x7SK3KcPOK6ZQ9pIQEDjSNoaC2uza_iuFNSieql3h-sTA";

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push messaging is not supported');
  }

  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  // If no subscription exists, subscribe
  if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      } catch (err) {
        console.error("Failed to subscribe to PushManager:", err);
        throw err;
      }
  }

  // Always send/update subscription on server to ensure it's fresh
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  if (token) {
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(subscription)
    });
  }

  return subscription;
}

export async function unsubscribeFromPushNotifications() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  
  if (subscription) {
    await subscription.unsubscribe();
  }
}

export async function getPushSubscription() {
    // Check if SW is supported before accessing
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return null;
    }
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
}