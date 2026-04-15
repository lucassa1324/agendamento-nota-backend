import webpush from "web-push";

const rawSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const subject =
  /^https?:\/\//.test(rawSubject) || rawSubject.startsWith("mailto:")
    ? rawSubject
    : `mailto:${rawSubject}`;
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    console.log("[WEBPUSH] VAPID details set successfully");
  } catch (error) {
    console.error("[WEBPUSH] Invalid VAPID configuration:", error);
  }
} else {
  console.warn("[WEBPUSH] VAPID keys missing. Push notifications will not work.");
}

export { webpush };
