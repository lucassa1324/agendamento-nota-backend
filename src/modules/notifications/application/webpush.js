import webpush from "web-push";
const rawSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const subject = /^https?:\/\//.test(rawSubject) || rawSubject.startsWith("mailto:")
    ? rawSubject
    : `mailto:${rawSubject}`;
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
if (publicKey && privateKey) {
    try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
    }
    catch (error) {
        console.error("[WEBPUSH] Invalid VAPID subject:", error);
    }
}
export { webpush };
