import { prisma } from '@/lib/prisma';
import { getDomFingerprintStatus } from '@/lib/noticeDomFingerprint';
import { getNoticeAutoCrawlerStatus } from '@/lib/noticeAutoCrawler';

export type OpsSnapshot = {
  capturedAt: string;
  db: {
    noticeCount: number;
    latestNoticeUpdatedAt: string | null;
  };
  autoCrawler: Awaited<ReturnType<typeof getNoticeAutoCrawlerStatus>>;
  domFingerprint: {
    boards: Awaited<ReturnType<typeof getDomFingerprintStatus>>;
    changedCount: number;
  };
};

export async function getOpsSnapshot(): Promise<OpsSnapshot> {
  const [noticeCount, latestNotice, autoCrawler, boards] = await Promise.all([
    prisma.notice.count(),
    prisma.notice.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    getNoticeAutoCrawlerStatus(),
    getDomFingerprintStatus(),
  ]);

  const changedCount = boards.filter((board) => board.changed).length;

  return {
    capturedAt: new Date().toISOString(),
    db: {
      noticeCount,
      latestNoticeUpdatedAt: latestNotice?.updatedAt ? latestNotice.updatedAt.toISOString() : null,
    },
    autoCrawler,
    domFingerprint: {
      boards,
      changedCount,
    },
  };
}
