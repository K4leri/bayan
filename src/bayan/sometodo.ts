import { UserStat } from "../types/sometypes.js";
import { fetchDataByChatId, updateBayanByChatId } from "../utils/db.js";
import { TextWithEntities } from "@mtcute/node";

export function getHumanReadableTime(timestamp: string | number | Date) {
    const date = new Date(timestamp);
              
    const year = date.getFullYear();
    const month = date.toLocaleString('en-US', { month: 'long' });
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');
    const timeZoneName = date.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ')[2];
    
    return `${month} ${day}, ${year} at ${hour}:${minute}:${second} ${timeZoneName}`;
}



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