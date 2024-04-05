import { UUID } from "crypto";
import { deleteById, fetchDataByChatId, selectById, updateBayanByChatId, updateById } from "../utils/db.js";
import { Message, html } from "@mtcute/node";
import { tg } from "../utils/tgclient.js";
import { UserStat } from "../types/sometypes.js";


export async function reCalculate(msg: Message, uuid: UUID, count: undefined | number) {
    const result = await selectById(uuid)
    if (!result) return tg.replyText(msg, 'Не смог найти такого')
    if (result.chatid !== msg.chat.id) return tg.replyText(msg, 'Не в том чате вводишь')
    if (count && count > result.count) return tg.replyText(msg, 'Хочешь бан получить ?')
    
    // Common update logic for count
    const adjustedCount = count || result.count;
    const newCount = result.count - adjustedCount;
    await updateById(uuid, newCount);

    // Common logic for updating bayanMeter and sending a response
    const bayanMeter = await fetchDataByChatId(msg.chat.id) as UserStat;
    const senderId = msg.sender.id.toString(); // Ensuring string representation
    const userBayanData = bayanMeter.bayan[senderId] || { count: 0, nickname: msg.sender.username || senderId };

    userBayanData.count -= adjustedCount; // Adjust bayanData count
    bayanMeter.bayan[senderId] = userBayanData; // Update in case it was initialized
    await updateBayanByChatId(msg.chat.id, bayanMeter.bayan);

    // Sending the updated count to the user
    const replyMessage = `Уменшил счетчик твоих баянов на ${adjustedCount}<br>${userBayanData.nickname}: ${userBayanData.count}`;
    await tg.replyText(msg, html`${replyMessage}`);
}