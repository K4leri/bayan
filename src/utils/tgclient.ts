import { Dispatcher } from '@mtcute/dispatcher'
import { TelegramClient } from '@mtcute/node'
import dotenv from 'dotenv';
dotenv.config();

export const tg = new TelegramClient({
    apiId: Number(process.env.API_ID!),
    apiHash: process.env.API_HASH!,
    storage: 'bot-data/session',
    // disableUpdates: true,
})

export const dp = Dispatcher.for(tg)