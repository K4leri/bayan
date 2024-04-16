import { ContextDefaultState, MessageContext } from "vk-io";
import { UserStat, UsernamesById } from "../types/sometypes.js";
import { fetchDataByChatId, getUsernameJSON, updateBayanByChatId, updateSettings, updateSettingsNotification } from "../utils/db.js";
import { TextWithEntities } from "@mtcute/node";
import { tg } from "../utils/tgclient.js";



export async function updateOrCreateBayanForChat(chatid: number, userIdStr: string, username: string, queuArrayLenght: number, pass: boolean): Promise<string> {
    const bayanMeter = await fetchDataByChatId(chatid)! as UserStat;
    const bayanData = bayanMeter.bayan;
    // console.log(bayanData)
    // console.log(`userIdStr is ${userIdStr}`)
    if (pass) {
        if (!bayanData[userIdStr]) {
            bayanData[userIdStr] = { count: queuArrayLenght, nickname: `${username}`}
        } else {
            bayanData[userIdStr].count = bayanData[userIdStr].count + queuArrayLenght 
        }
        await updateBayanByChatId(chatid, bayanData)
    }

    const bayanArray = Object.entries(bayanData);
    const sortedBayanArray = bayanArray.sort((a, b) => b[1].count - a[1].count);
    return sortedBayanArray.map(([userId, {nickname, count}]) => `${nickname}: ${count}<br>`).join('')
}

const min = -2147483648; // Minimum Int32 value
const max = 2147483647;  // Maximum Int32 value

export function generateRandomDigits(length: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


export async function someChatActionsWithText(context: MessageContext<ContextDefaultState> & object) {
    await context.loadMessagePayload({force: true})
    const matched = context.text!.match(/^\/set (off|@\S+)/)!
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
    return tg.sendText(context.chatId!, 'Установил связь с втоим тг аккаунтом', {replyTo: context.id})
    // return await context.reply('Установил связь с втоим тг аккаунтом')
}