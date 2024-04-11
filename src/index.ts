import { filters } from '@mtcute/dispatcher'
import { InputMedia, InputMediaPhoto, Message } from '@mtcute/node'
import { UUID } from "crypto";

import { CreateClass, deleteClass, gettAll } from './utils/weaviatePerStart.js';
import { processor } from './bayan/queueMain.js';
import { bot, botdp, dp, tg } from './utils/tgclient.js';
import { reCalculate } from './bayan/errorHandler.js';
import { vk } from './utils/vkclient.js';
import { getChatIdByPlatformId, getUsernameJSON, updateSettings, updateSettingsNotification } from './utils/db.js';
import { UsernamesById } from './types/sometypes.js';




// await deleteClass("Image");
await CreateClass("Image")
// await gettAll()
const newRegex = new RegExp(/^\/err\s([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\s(\d+))?(?:\s(\d{1,10}))?/g)

vk.updates.on('message_new', async (context, next) => {
    // console.log(context)
    // await context.loadMessagePayload({force: true})
    // console.log('---------------------------------------')
    // console.log(context)
    // return
    // if (!context.isOutbox) return
    if (context.peerType !== 'user') return
    if (context.text && /^\/set (off|@\S+)/.test(context.text)) {
        await context.loadMessagePayload({force: true})
        const matched = context.text.match(/^\/set (off|@\S+)/)!
        if (matched[1] ==='off') {
            return await updateSettingsNotification(context.peerId)
        }
        const nickname = matched[1]

        const data = await getUsernameJSON(nickname)
        // console.log(data)
        if (!data?.tgchatid) return await context.reply('Не смог найти телеграм аккаунта в своей базе')
        if (!data?.username) return await context.reply('Неизвестная ошибка')
        
        const key = Object.keys(data.username).find(key => (data.username as UsernamesById)[key] === nickname)!;
        // console.log(`key is ${key}`)
        // console.log(`senderId is ${context.senderId}`)
        data.username[context.senderId] = key;
        // console.log(data.username)
        await updateSettings(data.chatid, data.username, context.peerId, nickname, data.tgchatid)
        return await context.reply('Установил связь с втоим тг аккаунтом')
    }
    if (context.text && newRegex.test(context.text)) {
        const textArray = context.text.split(' ')
        return await reCalculate(context, textArray[1] as UUID, textArray[2] ? Number(textArray[2])-1 : undefined, textArray[3] ? textArray[3] : undefined); 
    }
    if (!context?.attachments || context?.attachments.length===0) return
    if (context.text && context.text.includes('\u2009')) return
    
    await context.loadMessagePayload({force: true})
    await processor.addVKMessage(context)
    return next();
});




dp.onNewMessage(
    filters.and(
        (msg: Message) => /Rem9999|disc0nn3ct|silverdille|K4leri/g.test(msg.sender.username ?? ""), // Using test() method and nullish coalescing operator
        filters.chat('private'),
        filters.photo,
    ), 
    async (msg) => {
        console.log(msg.sender.id)
        processor.addTGMessage(msg);    
    }
);

dp.onNewMessage(
    filters.and(
        (msg: Message) => newRegex.test(msg.text), // Using test() method and nullish coalescing operator
        filters.chat('private'),
    ),
    async (msg) => {
        const textArray = msg.text.split(' ')
        await reCalculate(msg, textArray[1] as UUID, textArray[2] ? Number(textArray[2])-1 : undefined, textArray[3] ? textArray[3] : undefined); 
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
);

(async () => {
    await vk.updates.start().catch(console.error);
    console.log(`VK bot started listening for updates`);
})()
// await gettAll()