import { filters } from '@mtcute/dispatcher'
import { BotInline, BotKeyboard, InputInlineMessage, InputInlineResultPhoto, InputMedia, InputMediaPhoto, Message, Photo, tl } from '@mtcute/node'
import { UUID } from "crypto";

import { CreateClass, deleteClass, gettAll } from './utils/weaviatePerStart.js';
import { processor } from './bayan/queueMain.js';
import { NotifBot, Notifdp, bot, botdp, dp, tg } from './utils/tgclient.js';
import { reCalculate, reCalculateAdmin } from './bayan/errorHandler.js';
import { vk } from './utils/vkclient.js';
import { findByUuid, findByUuidAndSelectOnlyFileId, getChatIdByPlatformId } from './utils/db.js';
import { GeneralGroupId, UsernamesById, fileIdObject, message } from './types/sometypes.js';
import { getTelegramPhotoBase64 } from './utils/action.js';
import { toInputUser } from '@mtcute/core/utils.js';
import { setInlineMessage } from './bayan/lagInlineHandler.js';
import { generateRandomDigits, someChatActionsWithText } from './bayan/sometodo.js';
import { searchImage } from './utils/weaviate.js';
import { ContextDefaultState, MessageContext, PhotoAttachment } from 'vk-io';
import { b64map, createStandartMenuForSearch, inlinePhotoResults } from './bayan/InlineQueries.js';






// await deleteClass("Image");
await CreateClass("Image")
// await gettAll()
const newRegex = new RegExp(/^\/err\s([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\s(\d+))?(?:\s(\d{1,10}))?/g)

vk.updates.on('message_new', async (context, next) => {
    if (context.peerType !== 'user') return
    if (context.text && /^\/set (off|@\S+)/.test(context.text)) await someChatActionsWithText(context)
    if (context.text && newRegex.test(context.text)) {
        const textArray = context.text.split(' ')
        await context.loadMessagePayload({force: true})
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
        (msg: Message) => /\/up/.test(msg.text),
        filters.chat('private'),
        filters.photo,
    ),
    async (msg) => {
        const b64 = await getTelegramPhotoBase64(msg)
        const data = await getChatIdByPlatformId({ tgchatid: msg.chat.id, userId: msg.sender.id })
        b64map.set(msg.sender.id, {b64: b64, chatid: Number(data.chatid)})
        await setInlineMessage('makeKeyboardForSearch', msg.chat.id)
    }
)


botdp.onInlineQuery(async (query) => {
    if (query.query === 'makeKeyboardForSearch') {
        await createStandartMenuForSearch(query)
    } else {
        await inlinePhotoResults(query)
    }
})


dp.onNewMessage(
    filters.and(
        (msg: Message) => /Rem9999|disc0nn3ct|silverdille|K4leri/g.test(msg.sender.username ?? ""), // Using test() method and nullish coalescing operator
        filters.chat('private'),
        filters.photo,
    ), 
    async (msg) => {
        console.log(msg.sender.id)
        console.log(msg.chat.id)
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

dp.onNewMessage(
    filters.and(
        (msg: Message) => /\/admin/.test(msg.text), // Using test() method and nullish coalescing operator
        filters.chat('private'),
        filters.userId(433894487)
    ),
    async (msg) => {
        const textArray = msg.text.split(' ')
        await reCalculateAdmin(msg, textArray[1] as UUID, textArray[2] ? Number(textArray[2])-1 : undefined, textArray[3] ? textArray[3] : undefined); 
    }
);

// Notifdp.onNewMessage(async (msg) => {
//     console.log(msg)
// })


// tg.run({
//     phone: () => tg.input('Phone > '),
//     code: () => tg.input('Code > '),
//     password: () => tg.input('Password > ')
//   }, async (self) => {
//     console.log(`Logged in as ${self.displayName}`)
//   })


bot.run({
    botToken: process.env.BOT_TOKEN,
  }, async (self) => {
    console.log(`Logged in as ${self.displayName}`)
})


NotifBot.run({
    botToken: process.env.NOTIF_BOT_TOKEN,
  }, async (self) => {
    console.log(`Logged in as ${self.displayName}`)
})

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

