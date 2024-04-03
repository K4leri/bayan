import { Dispatcher, filters } from '@mtcute/dispatcher'
import { html } from '@mtcute/html-parser'
import { InputMedia, InputMediaPhoto, Message, TelegramClient, UploadFileLike, UploadedFile } from '@mtcute/node'


import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { insertIntoPostgres } from './utils/db.js';
import { CreateClass, client, deleteClass, gettAll } from './utils/start.js';
import { processor } from './utils/queue.js';
import { dp, tg } from './utils/tgclient.js';




// await deleteClass("Image");
// await CreateClass("Image")
// await gettAll()

dp.onNewMessage(
    filters.and(
        (msg: Message) => /silverdille|K4leri/g.test(msg.sender.username ?? ""), // Using test() method and nullish coalescing operator
        filters.chat('private'),
        filters.photo,
    ),
    async (msg) => {

        // console.log(msg.chat.id)
        processor.addMessage(msg);
        
        // processor.addMessage(msg.chat.id, msg);
        // console.log(msg.groupedId?.low)
        // console.log(msg.chat.id)
        const fileid = msg.media.fileId
        const arrayBuffer = await tg.downloadAsBuffer(fileid)
        const b64 = Buffer.from(arrayBuffer).toString('base64');

    //     try {
    //         const resImage = await client.graphql.get()
    //             .withClassName('Image')
    //             .withFields('image')
    //             .withNearImage({ 
    //                 image: b64,
    //                 certainty: 0.92
    //             })
    //             .withLimit(5)
    //             .do();

    //         // console.log(JSON.stringify(resImage, null, 2));

    //         if (resImage.data?.Get?.Image.length>0) {
    //             const array: string[] = resImage.data?.Get?.Image.map((el: {image: string}) => el.image)
    //             const base64: string = array[0];
    //             const buffer = Buffer.from(base64, 'base64');

    //             let results: InputMediaPhoto[] = [];
    //             const maxArraySize = array.length - 1

    //             for (let [index, el] of array.entries()) {
    //                 const data = await tg.uploadFile({
    //                     file: Buffer.from(el, 'base64'),
    //                     fileName: 'some.jpg'
    //                 })
    //                 if (index !== maxArraySize) {
    //                     results.push(InputMedia.photo(data))
    //                 } else {
    //                     results.push(InputMedia.photo(data, {caption: html`Если какая-либо из фотографий не совыпадает, то пропиши <code>/err</code>`}))
    //                 }
    //             }

    //             // await tg.replyMediaGroup(results)
    //             await msg.answerMediaGroup(results)
    //             // const message: Message
    //             // await tg.replyText(message, 'Хочу глянуть, как работает')
    //             // const messsage = await msg.getReplyTo()
    //             // console.log(messsage)
                
            
    //         } else {
    //             console.log('должен был загрузить новый')
    //             const result = await client.data.creator()
    //               .withClassName('Image')
    //               .withProperties({
    //                 image: b64,
    //               })
    //               .do();
                
    //             await insertIntoPostgres(result.id, msg)
    //         }  

    //     } catch (e) {
    //         console.log(e)
    //     }
        
    }
);

// tg.run({
//     phone: () => tg.input('Phone > '),
//     code: () => tg.input('Code > '),
//     password: () => tg.input('Password > ')
//   }, async (self) => {
//     console.log(`Logged in as ${self.displayName}`)
//   })


tg.run(
    // { botToken: process.env.BOT_TOKEN },
    (user) => {
        console.log('Logged in as', user.username)
    },
)
