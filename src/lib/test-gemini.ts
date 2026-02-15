import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Explicitly load .env from project root
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

async function main() {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('Env Path:', envPath);
    console.log('API Key configured:', !!apiKey);
    if (apiKey) {
        console.log('API Key length:', apiKey.length);
        console.log('API Key start:', apiKey.substring(0, 4) + '...');
    }

    if (!apiKey) {
        console.error('No API Key found');
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    console.log('Testing model: gemini-3-flash-preview');

    try {
        const result = await model.generateContent('Hello, are you there?');
        console.log('Response:', result.response.text());
    } catch (e) {
        const error = e instanceof Error ? e : new Error('Unknown error');
        console.error('Error with 3-flash-preview:', error.message);

        console.log('--- Retrying with gemini-2.0-flash-exp ---');
        try {
            const model2 = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
            const result2 = await model2.generateContent('Hello');
            console.log('Response 2.0:', result2.response.text());
        } catch (e2) {
            const error = e2 instanceof Error ? e2 : new Error('Unknown error');
            console.error('Error with 2.0-flash-exp:', error.message);

        }
    }
}

main();
