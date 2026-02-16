import { prisma } from '@/lib/prisma';
import { isWebPushConfigured, sendWebPush, type StoredPushSubscription, type WebPushPayload } from '@/lib/webPush';

type PushDispatchResult = {
  attempted: number;
  sent: number;
  failed: number;
  removed: number;
};

type CrawlNoticeInput = {
  title: string;
  url: string;
};

function toStoredSubscription(row: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): StoredPushSubscription {
  return {
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
  };
}

async function dispatchToSubscriptions(
  subscriptions: Array<{ id: number; endpoint: string; p256dh: string; auth: string }>,
  payload: WebPushPayload,
): Promise<PushDispatchResult> {
  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const subscription of subscriptions) {
    const result = await sendWebPush(toStoredSubscription(subscription), payload);
    if (result.ok) {
      sent += 1;
      continue;
    }

    failed += 1;
    if (result.statusCode === 404 || result.statusCode === 410) {
      await prisma.pushSubscription.deleteMany({
        where: { id: subscription.id },
      });
      removed += 1;
    }
  }

  return {
    attempted: subscriptions.length,
    sent,
    failed,
    removed,
  };
}

export async function sendPushToUser(
  userId: number,
  payload: WebPushPayload,
): Promise<PushDispatchResult> {
  if (!isWebPushConfigured()) {
    return { attempted: 0, sent: 0, failed: 0, removed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  return dispatchToSubscriptions(subscriptions, payload);
}

export async function sendPushToAllUsers(payload: WebPushPayload): Promise<PushDispatchResult> {
  if (!isWebPushConfigured()) {
    return { attempted: 0, sent: 0, failed: 0, removed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  return dispatchToSubscriptions(subscriptions, payload);
}

export async function broadcastNewNoticePush(notices: CrawlNoticeInput[]): Promise<PushDispatchResult> {
  if (!isWebPushConfigured() || notices.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, removed: 0 };
  }

  const count = notices.length;
  const payload: WebPushPayload = count === 1
    ? {
      title: '새 공지 1건 도착',
      body: notices[0].title,
      url: notices[0].url,
      tag: `notice-new-${Date.now()}`,
    }
    : {
      title: `새 공지 ${count}건 도착`,
      body: notices.slice(0, 2).map((item) => item.title).join(' / '),
      url: '/',
      tag: `notice-batch-${Date.now()}`,
    };

  return sendPushToAllUsers(payload);
}
