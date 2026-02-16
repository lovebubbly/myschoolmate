import webpush from 'web-push';

type WebPushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let initialized = false;

function getConfig(): WebPushConfig | null {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim() || '';
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim() || '';
  const subject = process.env.WEB_PUSH_SUBJECT?.trim() || 'mailto:admin@myschoolmate.local';
  if (!publicKey || !privateKey) return null;

  return {
    publicKey,
    privateKey,
    subject,
  };
}

function ensureInitialized() {
  if (initialized) return;
  const config = getConfig();
  if (!config) return;

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  initialized = true;
}

export function isWebPushConfigured() {
  return getConfig() !== null;
}

export function getWebPushPublicKey() {
  return getConfig()?.publicKey ?? null;
}

export function toWebPushSubscription(subscription: StoredPushSubscription) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

export async function sendWebPush(
  subscription: StoredPushSubscription,
  payload: WebPushPayload,
): Promise<{ ok: true } | { ok: false; statusCode?: number; error: string }> {
  if (!isWebPushConfigured()) {
    return { ok: false, error: 'WEB_PUSH_NOT_CONFIGURED' };
  }

  ensureInitialized();

  try {
    await webpush.sendNotification(
      toWebPushSubscription(subscription),
      JSON.stringify(payload),
      {
        TTL: 60 * 60,
      },
    );
    return { ok: true };
  } catch (error) {
    const statusCode = typeof (error as { statusCode?: unknown }).statusCode === 'number'
      ? Number((error as { statusCode?: unknown }).statusCode)
      : undefined;
    return {
      ok: false,
      statusCode,
      error: String(error),
    };
  }
}
