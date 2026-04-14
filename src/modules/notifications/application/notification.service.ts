import { IPushSubscriptionRepository } from "../domain/ports/push-subscription.repository";
import { webpush } from "./webpush";

export class NotificationService {
  constructor(
    private pushSubscriptionRepository: IPushSubscriptionRepository
  ) {}

  async sendToUser(userId: string, title: string, message: string) {
    const subscriptions = await this.pushSubscriptionRepository.findAllByUserId(userId);
    
    if (!subscriptions || subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const payload = JSON.stringify({
      title,
      body: message,
      icon: "/android-chrome-192x192.png",
      badge: '/badge.png',
      data: {
        url: "/",
        timestamp: Date.now()
      }
    });

    console.log(`[NOTIFICATION_SERVICE] Enviando payload: ${payload}`);

    let sentCount = 0;
    let failedCount = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }, payload);
        sentCount++;
      } catch (error: any) {
        console.error(`[NOTIFICATION_SERVICE] Error sending to ${sub.endpoint}:`, error.statusCode);
        
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[NOTIFICATION_SERVICE] Removing expired subscription: ${sub.id}`);
          await this.pushSubscriptionRepository.deleteByEndpoint(sub.endpoint);
        }
        failedCount++;
      }
    }

    return { sent: sentCount, failed: failedCount };
  }
}
