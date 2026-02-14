import NextAuth, { getServerSession, type NextAuthOptions } from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';

const providers: NextAuthOptions['providers'] = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })
    );
}

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
    providers.push(
        GitHub({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
        })
    );
}

export const authOptions: NextAuthOptions = {
    secret: process.env.AUTH_SECRET,
    session: { strategy: 'jwt' },
    providers,
};

export const authHandler = NextAuth(authOptions);

export function auth() {
    return getServerSession(authOptions);
}
