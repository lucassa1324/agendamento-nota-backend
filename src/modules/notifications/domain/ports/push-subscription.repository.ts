export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPushSubscriptionRepository {
  upsert(userId: string, endpoint: string, p256dh: string, auth: string): Promise<PushSubscription>;
  findAllByUserId(userId: string): Promise<PushSubscription[]>;
  findByEndpoint(endpoint: string): Promise<PushSubscription | null>;
  deleteById(id: string): Promise<void>;
  deleteByEndpoint(endpoint: string): Promise<void>;
}
