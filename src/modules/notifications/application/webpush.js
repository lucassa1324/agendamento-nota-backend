import webpush from "web-push";
const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
}
export { webpush };
