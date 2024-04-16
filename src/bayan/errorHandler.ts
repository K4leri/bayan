import { UUID } from "crypto";
import { fetchDataByChatId, getChatIdByPlatformId, selectById, updateBayanByChatId, updateById } from "../utils/db.js";
import { InputMessageId, Message, TextWithEntities, html } from "@mtcute/node";
import { tg } from "../utils/tgclient.js";
import { Settings, SomeErrors, UserStat } from "../types/sometypes.js";
import { createImageAndInsertIntoPostgres } from "../utils/weaviate.js";
import { Attachment, ContextDefaultState, ExternalAttachment, MessageContext, PhotoAttachment } from "vk-io";
import { vk } from "../utils/vkclient.js";
import { getVKPhotoBase64 } from "../utils/action.js";
import { generateRandomDigits } from "./sometodo.js";




function isTGMessage(msg: any): msg is Message {
    return 'chat' in msg && 'id' in msg.chat;
}

function isVKMessage(msg: any): msg is MessageContext<ContextDefaultState> & object {
    return 'peerId' in msg;
}

const platforms = {
    TG: {
        getChatId: (msg: any) => isTGMessage(msg) ? msg.chat.id : null,
        getUserId: (msg: any) => msg.sender.id,
        reply: (msg: any, text: string|TextWithEntities) => {
            if (isTGMessage(msg)) {
                return tg.replyText(msg, text); // Assuming tg.replyText accepts Message
            }
            // Handle error or unexpected case
            console.error("Invalid message type for TG platform.");
        },
        uploadTodb: async (settingsPromise: Settings, result: SomeErrors, fileidArray: string[], chatIdtrue: number) => {
            // const InputMessage = {chatId: settingsPromise.tgchatid, message: result.message} as InputMessageId
            // const data = await tg.getMessageGroup(InputMessage)
            // const messageArrayLengt = data.length
            // const groupId = (messageArrayLengt > 1) ? data[0].groupedId!.low : 0
            // for (let i=0; i<messageArrayLengt; i++) {
            //     //@ts-ignore
            //     const fileid = data[i].media.fileId as string
            //     fileidArray.push(fileid)
            //     const arrayBuffer = await tg.downloadAsBuffer(fileid);
            //     const b64 = Buffer.from(arrayBuffer).toString('base64');
            //     await createImageAndInsertIntoPostgres(b64, result.message, groupId, result.platform, chatIdtrue);
            // }
            // return messageArrayLengt
            const message = result.message as number
            console.log(message)
            const data = await tg.getMessages(Number(settingsPromise.tgchatid!), [message]) as Message[]
            console.log(data[0])
            const groupId = data[0].groupedId?.low || 0
            //@ts-ignore
            const fileid =  data[0].media.fileId
            const arrayBuffer = await tg.downloadAsBuffer(fileid);
            const b64 = Buffer.from(arrayBuffer).toString('base64');
            await createImageAndInsertIntoPostgres(b64, message, groupId, result.platform, chatIdtrue);
            return 1
        },
        delete: (result: any) => {
            // tg.deleteMessagesById(, result.message)
            // tg.deleteMessages([result.message])
        },
        platform: 'tgchatid',
    },
    VK: {
        getChatId: (msg: any) => isVKMessage(msg) ? msg.peerId : null,
        getUserId: (msg: any) => msg.senderId,
        reply: (msg: any, text: string|TextWithEntities) => {
            if (isVKMessage(msg)) {
                return vk.api.messages.send({peer_id: msg.peerId, message: (text as TextWithEntities).text, random_id: generateRandomDigits(12)})
            }
            
            // Handle error or unexpected case
            console.error("Invalid message type for VK platform.");
        },
        uploadTodb: async (settingsPromise: Settings, result: SomeErrors, fileidArray: string[], chatIdtrue: number) => {
            const b64 = await getVKPhotoBase64(result.message as PhotoAttachment)
            // console.log(b64.substring(0, 80))
            const groupId = 0
            await createImageAndInsertIntoPostgres(b64, 0, groupId, result.platform, chatIdtrue);
            return 1
        },
        delete: (result: any) => {
            console.log('Нужно сделать удаление из вк')
            return 
            // return await tg.deleteMessages([result.message])
        },
        platform: 'vkchatid',
    },
    // Future platforms can be added here
};

function getPlatform(msg: any): keyof typeof platforms {
    if (msg instanceof Message) return 'TG';
    // Additional instanceof checks for other platforms
    return 'VK'; // Default or based on additional checks
}


export async function reCalculateAdmin(
    msg: Message | MessageContext<ContextDefaultState> & object, 
    uuid: UUID, 
    count: undefined | number, 
    positions: string | undefined
) {
    const result = await selectById(uuid);
    const platformKey = getPlatform(msg);
    if (!result) return platforms[platformKey].reply(msg, 'Не смог найти такого');
    
    const settingsPromise = await getChatIdByPlatformId({ 
            [platforms[platformKey].platform]: platforms[platformKey].getChatId(msg), 
            userId: platforms[platformKey].getUserId(msg)
    });

    const adjustedCount = count || result.count;
    const newCount = result.count - adjustedCount;
    const chatIdtrue = Number(settingsPromise.chatid)
    await updateById(uuid, newCount);

    const bayanMeter = await fetchDataByChatId(chatIdtrue) as UserStat;
    const senderId = msg.sender.id.toString(); // Ensuring string representation
    const userBayanData = bayanMeter.bayan[senderId] || { count: 0, nickname: msg.sender.username || senderId };

    userBayanData.count -= adjustedCount; // Adjust bayanData count
    bayanMeter.bayan[senderId] = userBayanData; // Update in case it was initialized
    await updateBayanByChatId(chatIdtrue, bayanMeter.bayan);
    
    platforms[platformKey].reply(msg, 'Удалил из бд статистику без добавления фото')

}



export async function reCalculate(
    msg: Message | MessageContext<ContextDefaultState> & object, 
    uuid: UUID, 
    count: undefined | number, 
    positions: string | undefined
) {
    const result = await selectById(uuid);
    const platformKey = getPlatform(msg);
    if (!result)  return platforms[platformKey].reply(msg, 'Не смог найти такого');
    
    const settingsPromise = await getChatIdByPlatformId({ 
            [platforms[platformKey].platform]: platforms[platformKey].getChatId(msg), 
            userId: platforms[platformKey].getUserId(msg)
    });
    
    
    // console.log(`${result.chatid} !== ${settingsPromise.chatid}`)
    // console.log(`${typeof(result.chatid)} !== ${typeof(settingsPromise.chatid)}`)

    if (result.chatid !== settingsPromise.chatid) return platforms[platformKey].reply(msg, 'Не в том чате вводишь');
    if (count && count > result.count) return platforms[platformKey].reply(msg, 'Хочешь бан получить ?');
    
    // Common update logic for count
    const adjustedCount = count || result.count;
    const newCount = result.count - adjustedCount;
    const chatIdtrue = Number(settingsPromise.chatid)
    await updateById(uuid, newCount);
    // settingsPromise.
    // Common logic for updating bayanMeter and sending a response
    const bayanMeter = await fetchDataByChatId(chatIdtrue) as UserStat;
    const senderId = (msg.sender) ? msg.sender.id.toString() : settingsPromise.username![(msg as MessageContext<ContextDefaultState> & object).senderId]
    const userBayanData = bayanMeter.bayan[senderId] || { count: 0, nickname: msg.sender.username || senderId };

    userBayanData.count -= adjustedCount; // Adjust bayanData count
    bayanMeter.bayan[senderId] = userBayanData; // Update in case it was initialized
    await updateBayanByChatId(chatIdtrue, bayanMeter.bayan);
    let text = ''
    if (!count) {
        const fileidArray: string[] = []
        const messageArrayLengt = await platforms[platformKey].uploadTodb(settingsPromise, result, fileidArray, chatIdtrue)
        text = `И загрузил ${messageArrayLengt} ${(messageArrayLengt === 1) ? 'фотку' : 'фоток'} в бд`
        platforms[platformKey].delete(result)
        // await tg.deleteMessages([result.message])
    } 

    if (positions) {
        const numbers = positions.split('').map(digit => +digit-1)
        if (platformKey === 'TG') {
            console.log(`${positions} - столько вот обработать`)
            const messages = await tg.getMessageGroup({chatId: settingsPromise.tgchatid!, message: result.message as number})
            let indexies: number[] = []
            for (let index of numbers) {
                if (!messages[index]) continue
                indexies.push(index)
                console.log(index)
                //@ts-ignore
                const fileid = messages[index].media!.fileId;
                const groupId = messages[index].groupedId?.low || 0
                const arrayBuffer = await tg.downloadAsBuffer(fileid);
                const b64 = Buffer.from(arrayBuffer).toString('base64');
                await createImageAndInsertIntoPostgres(b64, messages[index].id, groupId, result.platform, chatIdtrue);
            }
            const amount = indexies.length
            if (amount>0) {
                text = `И загрузил ${amount} фотографию(ий) в бд<br>Под номерами ${indexies.join(', ')}`
                await tg.replyText(msg as Message, text)
                await tg.deleteMessages(indexies.map(el => messages[el]))
            }
        }
        if (platformKey === 'VK') {
            // vk.api.messages.getHistoryAttachments
            platforms[platformKey].reply(msg, 'для вк пока не сделана логика, сори')
        }
    }

    // Sending the updated count to the user
    const replyMessage = html`Уменшил счетчик твоих баянов на ${adjustedCount}<br>${userBayanData.nickname}: ${userBayanData.count}<br><br>${html(text)}`;
    platforms[platformKey].reply(msg, replyMessage)
}