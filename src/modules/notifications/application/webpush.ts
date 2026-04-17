import webpush from "web-push";

const rawSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const subject =
  /^https?:\/\//.test(rawSubject) || rawSubject.startsWith("mailto:")
    ? rawSubject
    : `mailto:${rawSubject}`;
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

let isConfigured = false;

if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    isConfigured = true;
    console.log("[WEBPUSH] VAPID details set successfully");
  } catch (error) {
    console.error("[WEBPUSH] Invalid VAPID configuration:", error);
  }
} else {
  console.warn("[WEBPUSH] VAPID keys missing. Push notifications will not work.");
}

// Re-export original webpush but with a helper for sending
const originalSendNotification = webpush.sendNotification;

// Wrapper for checking configuration before sending
webpush.sendNotification = async (subscription: any, payload: any, options?: any) => {
  if (!isConfigured) {
    // Try to re-configure if keys are available now
    const pk = process.env.VAPID_PUBLIC_KEY;
    const prk = process.env.VAPID_PRIVATE_KEY;
    if (pk && prk) {
      try {
        webpush.setVapidDetails(subject, pk, prk);
        isConfigured = true;
        console.log("[WEBPUSH] VAPID details re-configured on demand");
      } catch (e) {
        console.error("[WEBPUSH] Re-configuration failed:", e);
      }
    }
    
    if (!isConfigured) {
      console.error("[WEBPUSH] Cannot send notification: web-push is not configured (VAPID keys missing)");
      throw new Error("Push notifications not configured on server");
    }
  }
  return originalSendNotification(subscription, payload, options);
};

export { webpush };
