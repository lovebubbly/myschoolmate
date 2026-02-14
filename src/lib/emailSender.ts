import nodemailer, { type Transporter } from 'nodemailer';

type SendEmailInput = {
    to: string;
    subject: string;
    text: string;
    html?: string;
};

export type SendEmailResult = {
    ok: boolean;
    mode: 'smtp' | 'dry-run';
    messageId?: string;
    error?: string;
};

type SmtpConfig = {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
};

const globalForEmail = globalThis as typeof globalThis & {
    __smtpTransporter?: Transporter;
    __smtpSignature?: string;
};

function parseBoolean(raw: string | undefined) {
    if (!raw) return false;
    return raw === '1' || raw.toLowerCase() === 'true';
}

function getSmtpConfig(): SmtpConfig | null {
    const host = process.env.SMTP_HOST?.trim() || '';
    const portRaw = process.env.SMTP_PORT?.trim();
    const user = process.env.SMTP_USER?.trim() || '';
    const pass = process.env.SMTP_PASS || '';
    const from = process.env.SMTP_FROM?.trim() || '';
    const port = Number(portRaw || '587');
    const secure = parseBoolean(process.env.SMTP_SECURE) || port === 465;

    if (!host || !user || !pass || !from || !Number.isFinite(port) || port <= 0) {
        return null;
    }

    return { host, port, secure, user, pass, from };
}

function getTransporter(config: SmtpConfig): Transporter {
    const signature = `${config.host}:${config.port}:${config.user}:${config.secure}`;

    if (!globalForEmail.__smtpTransporter || globalForEmail.__smtpSignature !== signature) {
        globalForEmail.__smtpTransporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: config.user,
                pass: config.pass,
            },
        });
        globalForEmail.__smtpSignature = signature;
    }

    return globalForEmail.__smtpTransporter;
}

export function isSmtpConfigured() {
    return getSmtpConfig() !== null;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const config = getSmtpConfig();
    if (!config) {
        return {
            ok: true,
            mode: 'dry-run',
        };
    }

    try {
        const transporter = getTransporter(config);
        const info = await transporter.sendMail({
            from: config.from,
            to: input.to,
            subject: input.subject,
            text: input.text,
            html: input.html,
        });

        return {
            ok: true,
            mode: 'smtp',
            messageId: info.messageId,
        };
    } catch (error) {
        return {
            ok: false,
            mode: 'smtp',
            error: String(error),
        };
    }
}
