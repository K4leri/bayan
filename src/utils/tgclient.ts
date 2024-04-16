import { Dispatcher } from '@mtcute/dispatcher'
import { TelegramClient } from '@mtcute/node'
import dotenv from 'dotenv';
dotenv.config();

export const tg = new TelegramClient({
    apiId: Number(process.env.API_ID!),
    apiHash: process.env.API_HASH!,
    storage: 'bot-data/user/session',
    // logLevel: 0
    // disableUpdates: true,
})

export const bot = new TelegramClient({
    apiId: Number(process.env.API_ID!),
    apiHash: process.env.API_HASH!,
    storage: 'bot-data/bot/session',
    // logLevel: 0
    // disableUpdates: true,
})

export const NotifBot = new TelegramClient({
    apiId: Number(process.env.API_ID!),
    apiHash: process.env.API_HASH!,
    storage: 'bot-data/notifBot/session',
    // logLevel: 5
    // disableUpdates: true,
})

export const dp = Dispatcher.for(tg)
export const botdp = Dispatcher.for(bot)
export const Notifdp = Dispatcher.for(NotifBot)