import { Dispatcher, filters } from '@mtcute/dispatcher'
import { html } from '@mtcute/html-parser'
import { InputMedia, InputMediaPhoto, Message, TelegramClient, UploadFileLike, UploadedFile } from '@mtcute/node'
import { UUID } from "crypto";

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { insertIntoPostgres } from './utils/db.js';
import { CreateClass, client, deleteClass, gettAll } from './utils/weaviatePerStart.js';
// import { processor } from './utils/queue.js';
import { processor } from './bayan/queueMain.js';
import { bot, botdp, dp, tg } from './utils/tgclient.js';
import { reCalculate } from './bayan/errorHandler.js';




// await deleteClass("Image", '8327120e-bad3-4018-ba4e-12be7275696e');
// await CreateClass("Image")
// await gettAll()

dp.onNewMessage(
    filters.and(
        (msg: Message) => /silverdille|K4leri/g.test(msg.sender.username ?? ""), // Using test() method and nullish coalescing operator
        filters.chat('private'),
        filters.photo,
    ),
    async (msg) => {
        processor.addMessage(msg);    
    }
);

dp.onNewMessage(
    filters.and(
        (msg: Message) => /\/err\s([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\s(\d+))?/g.test(msg.text), // Using test() method and nullish coalescing operator
        filters.chat('private'),
        filters.photo,
    ),
    async (msg) => {
        const textArray = msg.text.split(' ')
        await reCalculate(msg, textArray[1] as UUID, textArray[2] ? Number(textArray[2]) : undefined); 
    }
);
// tg.run({
//     phone: () => tg.input('Phone > '),
//     code: () => tg.input('Code > '),
//     password: () => tg.input('Password > ')
//   }, async (self) => {
//     console.log(`Logged in as ${self.displayName}`)
//   })


// bot.run({
//     botToken: process.env.BOT_TOKEN,
//   }, async (self) => {
//     console.log(`Logged in as ${self.displayName}`)
// })


tg.run(
    // { botToken: process.env.BOT_TOKEN },
    (user) => {
        console.log('Logged in as', user.username)
    },
)

await gettAll()