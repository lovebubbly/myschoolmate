import type { UserProfile } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateSessionProfile } from '@/lib/sessionUser';

type ResolvedUserProfile = {
    userId: number;
    profile: UserProfile;
    setCookie?: string;
    source: 'oauth' | 'anonymous';
};

function defaultProfileData() {
    return {
        grade: 1,
        income: 10,
        gpa: 0.0,
    };
}

export async function resolveUserProfile(request: Request): Promise<ResolvedUserProfile> {
    const session = await auth();
    const email = session?.user?.email?.trim().toLowerCase();

    if (email) {
        const identityKey = `email:${email}`;
        const displayName = session?.user?.name?.trim() || null;

        let profile = await prisma.userProfile.findUnique({ where: { identityKey } });

        if (!profile) {
            profile = await prisma.userProfile.create({
                data: {
                    ...defaultProfileData(),
                    identityKey,
                    email,
                    notificationEmail: email,
                    displayName,
                },
            });
        } else {
            const shouldUpdate =
                profile.email !== email ||
                (displayName !== null && displayName !== profile.displayName);

            if (shouldUpdate) {
                profile = await prisma.userProfile.update({
                    where: { id: profile.id },
                    data: {
                        email,
                        notificationEmail: profile.notificationEmail ?? email,
                        displayName: displayName ?? profile.displayName,
                    },
                });
            }
        }

        return {
            userId: profile.id,
            profile,
            source: 'oauth',
        };
    }

    const anonymous = await getOrCreateSessionProfile(request);
    return {
        userId: anonymous.userId,
        profile: anonymous.profile,
        setCookie: anonymous.setCookie,
        source: 'anonymous',
    };
}
