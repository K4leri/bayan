import { tg } from "../utils/tgclient.js"
import { randomLong, toInputUser } from "@mtcute/core/utils.js"



export async function setInlineMessage(text: string, chatid: number, offset: string = '', ) {
    const chat = await tg.resolvePeer(chatid)
    const botpeer = toInputUser(await tg.resolvePeer('bayianobot'))!

    const results = await tg.call({
        _: 'messages.getInlineBotResults',
        bot: botpeer,
        peer: chat,
        query: text,
        offset: offset
    }, { throw503: true })

    // console.log(results)
    const first = results.results[0]

    const res = await tg.call({
        _: 'messages.sendInlineBotResult',
        peer: chat,
        randomId: randomLong(),
        queryId: results.queryId,
        id: first.id
    })

    await tg.handleClientUpdate(res, true)
}