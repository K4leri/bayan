import { UUID } from "crypto";
import { fetchDataByChatId, getChatIdByPlatformId, selectById, updateBayanByChatId, updateById } from "../utils/db.js";
import { InputMessageId, Message, TextWithEntities, html } from "@mtcute/node";
import { tg } from "../utils/tgclient.js";
import { UserStat } from "../types/sometypes.js";
import { createImageAndInsertIntoPostgres } from "../utils/weaviate.js";
import { ContextDefaultState, MessageContext } from "vk-io";
import { vk } from "../utils/vkclient.js";




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
        delete: (result: any) => {
            tg.deleteMessages([result.message])
        },
        platform: 'tgchatid',
    },
    VK: {
        getChatId: (msg: any) => isVKMessage(msg) ? msg.peerId : null,
        getUserId: (msg: any) => msg.senderId,
        reply: (msg: any, text: string|TextWithEntities) => {
            if (isVKMessage(msg)) {
                return msg.send(text); // Assuming msg.send exists for VK messages
            }
            // Handle error or unexpected case
            console.error("Invalid message type for VK platform.");
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


export async function reCalculate(
    msg: Message | MessageContext<ContextDefaultState> & object, 
    uuid: UUID, 
    count: undefined | number, 
    positions: string | undefined
) {
    const result = await selectById(uuid);
    const platformKey = getPlatform(msg);
    if (!result)  return platforms[platformKey].reply(msg, 'Не смог найти такого');
    
    const settingsPromise = await getChatIdByPlatformId(
        { [platforms[platformKey].platform]: platforms[platformKey].getChatId(msg), 
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

    // Common logic for updating bayanMeter and sending a response
    const bayanMeter = await fetchDataByChatId(chatIdtrue) as UserStat;
    const senderId = msg.sender.id.toString(); // Ensuring string representation
    const userBayanData = bayanMeter.bayan[senderId] || { count: 0, nickname: msg.sender.username || senderId };

    userBayanData.count -= adjustedCount; // Adjust bayanData count
    bayanMeter.bayan[senderId] = userBayanData; // Update in case it was initialized
    await updateBayanByChatId(chatIdtrue, bayanMeter.bayan);

    let text = ''
    if (!count) {
        //@ts-ignore
        const fileid =  result.message.media!.fileId;
        const groupId = result.message.groupedId?.low || 0
        const arrayBuffer = await tg.downloadAsBuffer(fileid);
        const b64 = Buffer.from(arrayBuffer).toString('base64');
        await createImageAndInsertIntoPostgres(b64, result.message, groupId, result.platform, chatIdtrue);
        text = 'И загрузил одну фотку в бд'
        platforms[platformKey].delete(result)
        // await tg.deleteMessages([result.message])
    } 

    if (positions) {
        if (platformKey === 'TG') {
            console.log(`${positions} - столько вот обработать`)
            const numbers = positions.split('').map(digit => +digit-1)
            const messages = await tg.getMessageGroup({chatId: result.message.chat.id, message: result.message.id})
            let indexies: number[] = []
            for (let index of numbers) {
                if (!messages[index]) continue
                indexies.push(index)
                console.log(index)
                //@ts-ignore
                const fileid = messages[index].media!.fileId;
                const groupId = result.message.groupedId?.low || 0
                const arrayBuffer = await tg.downloadAsBuffer(fileid);
                const b64 = Buffer.from(arrayBuffer).toString('base64');
                await createImageAndInsertIntoPostgres(b64, messages[index], groupId, result.platform, chatIdtrue);
            }
            const amount = indexies.length
            if (amount>0) {
                text = `И загрузил ${amount} фотографию(ий) в бд<br>Под номерами ${indexies.join(', ')}`
                await tg.deleteMessages(indexies.map(el => messages[el]))
            }
        }
        if (platformKey === 'VK') {
            platforms[platformKey].reply(msg, 'для вк пока не сделана логика, сори')
        }
    }

    // Sending the updated count to the user
    const replyMessage = html`Уменшил счетчик твоих баянов на ${adjustedCount}<br>${userBayanData.nickname}: ${userBayanData.count}<br><br>${html(text)}`;
    platforms[platformKey].reply(msg, replyMessage)
}