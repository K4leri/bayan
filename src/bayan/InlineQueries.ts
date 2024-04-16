import { BotInline, BotKeyboard, InputInlineMessage, InputInlineResultPhoto } from "@mtcute/core"
import { generateRandomDigits } from "./sometodo.js"
import { InlineQueryContext } from "@mtcute/dispatcher"
import { searchImage } from "../utils/weaviate.js"
import { findByUuidAndSelectOnlyFileId } from "../utils/db.js"
import { fileIdObject } from "../types/sometypes.js"

export const b64map = new Map()

export async function createStandartMenuForSearch(query: InlineQueryContext) {
    const random = generateRandomDigits(12)
    const replyMarkup = BotKeyboard.inline([
        [BotKeyboard.switchInline('push me', '', true)]
    ])
    const message: InputInlineMessage = { 
        text: 'Прожми кнопку ниже, чтобы начать поиск', 
        replyMarkup,
        type: 'text'
    }

    await query.answer([
        BotInline.article(
            random.toString(),
            {
              title: 'q',
              description: 'q',
              message: message
            }
        )
    ])
}


export async function inlinePhotoResults(query: InlineQueryContext) {
    const userid = query.user.id
    const data = b64map.get(userid)
    if (!data) return

    const b64 = data.b64
    const chatId = data.chatid
    
    
    const queryText = (query.query) ? (!isNaN(Number(query.query))) ? Number(query.query)/100 : 0.80 : 0.80
    if (queryText>1) return
    console.log(queryText)
    const result = await searchImage(b64, chatId, queryText, 10);
    const countResultFromVectorDB = result.data.Get.Image.length;

    if (countResultFromVectorDB > 0) {
        const uuidArray: string[] = []
        const somePromiseFunctions: Promise<fileIdObject[]>[] = [];

        for (let i=0; i<countResultFromVectorDB; i++) {
            const uuid = result.data.Get.Image[i]._additional.id
            if (!uuidArray.includes(uuid)) {
                somePromiseFunctions.push(findByUuidAndSelectOnlyFileId(uuid, chatId))
                uuidArray.push(uuid)
            }
        }

        const data = await Promise.all(somePromiseFunctions)
        const inlineResult: InputInlineResultPhoto[] = []

        data.forEach((el, index) => {
            if (el[0]?.fileid) {
                const shouldInsert = BotInline.photo(
                    `RESULT_ID${index}`,
                    el[0].fileid,
                )
                inlineResult.push(shouldInsert)   
            }
        })

        await query.answer(inlineResult, {cacheTime: 0})
    }
}