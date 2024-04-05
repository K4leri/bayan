import { InputMedia, InputMediaPhoto, Message, UploadedFile, html } from "@mtcute/node";
import { client } from "./start.js";
import { tg } from "./tgclient.js";
import { fetchDataByChatId, findByUuid, getMessagesByUUIDs, insertIntoPostgres, updateBayanByChatId } from "./db.js";
import { BlobOptions } from "buffer";
import { UserStat, message } from "../types/sometypes.js";
import { getHumanReadableTime, updateOrCreateBayanForChat } from "./sometodo.js";
import { createImageAndInsertIntoPostgres, searchImage } from "./insertTodb.js";




interface ProcessEntry {
    data: {images: string, uuid: string, groupid: number}[];
    count: number;
}

interface NeedToProcessMap {
    [key: string]: {
        data: {images: string, uuid: string, groupid: number}[];
        count: number;
    }; // Using string keys because JavaScript object keys are strings
}

interface GeneralGroupId {
    [key: string]: {
        count: number;
        data: {
            image: string;
            uuid: string;
            groupid: number
        }[]
    };
}

class ChatMessageProcessor {
    private queues: { [chatId: string]: { [groupedId: string]: { messages: Message[]; timer?: NodeJS.Timeout } } };
  
    constructor() {
      this.queues = {};
    }
  




    async processQueue(chatId: number, groupId: number) {
        // Example: Process messages for a specific chatId
        // console.log('начал выполнять')
        const queue = this.queues[chatId]?.[groupId];

        const queuArrayLenght = queue.messages.length
        console.log(`Processing ${queuArrayLenght} messages for chat ${chatId}`);
        
        
        const username = `@${queue.messages[0].sender.username}` ?? queue.messages[0].sender.id
        // const needToFind = (groupId) ? 5 : 5
        const needToProcess: NeedToProcessMap = {};

        const searchimageArray: string[]  = [];
        const functionArray: Function[] = []
        const generalGroupId: GeneralGroupId = {};


        let breakFromLoop = false
        const processedPhotos = new Set<string>(); // Tracks UUIDs of processed photos

        for (let [index, message] of queue.messages.entries()) {
            //@ts-ignore
            const fileid = message.media!.fileId;
            const chatid = message.chat.id
            const arrayBuffer = await tg.downloadAsBuffer(fileid);
            const b64 = Buffer.from(arrayBuffer).toString('base64');
            let result = await searchImage(b64, chatId, 0.98, 1)

            if (result.data.Get.Image.length === 0) {
                // console.log(`${index} - не нашел по одной фотке`)
                result = await searchImage(b64, chatId, 0.94, 3)
                // console.log(`${result.data.Get.Image.length} - дополнительных фоток`)
            }
            const countResultFromVectorDB = result.data.Get.Image.length
            // let pass = 0

            if (countResultFromVectorDB>0) {
                const newFreeFromSame: { images: string, uuid: string, groupid: number }[] = [];
                let pass = 0
                for (let element of result.data.Get.Image) {
                    if (searchimageArray.includes(element.image)) {
                        pass++
                        continue
                    }
                    searchimageArray.push(element.image)
                    const groupId = element.groupid
                    newFreeFromSame.push({ images: element.image, uuid: element._additional.id, groupid: groupId });
                    if (!generalGroupId[groupId]) {
                        generalGroupId[groupId] = {count: 1, data:[{image: element.image, uuid:  element._additional.id, groupid: groupId}]}
                    } else {
                        generalGroupId[groupId].count = generalGroupId[groupId].count + 1
                        generalGroupId[groupId].data.push({image: element.image, uuid:  element._additional.id, groupid: groupId})
                    }

                    if (generalGroupId[groupId].count === queuArrayLenght) breakFromLoop = true
                    console.log(breakFromLoop)
                }

                if (pass) {
                    console.log(`${index} - должен был обновить`)
                    // functionArray.push(() => createImageAndInsertIntoPostgres(b64, message, groupId));
                }
                // if (newFreeFromSame.length > 0) {
                //     needToProcess[index] = { data: newFreeFromSame, count: newFreeFromSame.length };
                // } else {
                //     console.log('должен был обновить')
                //     // functionArray.push(() => createImageAndInsertIntoPostgres(b64, message, groupId));
                // }

                // if (breakFromLoop) break
            } 

            else {
                console.log(`${index} - должен был обновить`)
                // functionArray.push(() => createImageAndInsertIntoPostgres(b64, message, groupId));
            }
        }

        if (functionArray.length>0) await Promise.all(functionArray.map(func => func()));
        
        console.log(generalGroupId)
        console.log('тут')
        const imageArray: string[]  = [];
        
        if (breakFromLoop || Object.keys(generalGroupId).length === 1) {
            console.log('попал в залупу повторяющуюся')
            let shouldBreakFromLoop = false
            const procceedKey = Number(Object.keys(generalGroupId)[0])
            // const procceedKey = Number(Object.entries(generalGroupId).reduce<[string, { count: number; data: any[] }]>((acc, curr) => {
            //     // Ensure TypeScript understands the structure of acc and curr correctly:
            //     // acc is an array where acc[0] is a number (the key) and acc[1] is an object { count: number; data: any[] }
            //     // curr follows the same structure
            //     return curr[1].count > acc[1].count ? curr : acc;
            // }, ["0", { count: -Infinity, data: [] }])[0]); // Provide an initial value that matches the expected structure
            console.log(`${procceedKey} - уникальный ключ для группы`)
            let uuid: string = generalGroupId[procceedKey].data[0].uuid
            // let uuid: string = needToProcess[0].data[0].uuid


            console.log('пока что перед полученим файлов')
            for (const [index, value] of Object.entries(generalGroupId)) {
                if (shouldBreakFromLoop) break
                const photosLenght = value.data.length
                console.log(`длина массива сейчас такая - ${photosLenght}`)
                for (let i=0; i<photosLenght; i++) {
                    if (value.data[i].groupid !== procceedKey) continue
                    // if (imageArray.includes(value.data[i].images)) continue
                    imageArray.push(value.data[i].image)
                    if (imageArray.length === queuArrayLenght) {
                        uuid = value.data[i].uuid
                        shouldBreakFromLoop = true
                        break
                    }
                }
            }

            console.log(uuid)
            console.log('уже после получения файлов')
            // console.log(imageArray)
            let files: InputMediaPhoto[] = []
            const imgLenght = imageArray.length-1
            for (let i=0; i<imgLenght; i++) {{
                // console.log(imageArray[i].substring(0, 40))
                const data = await tg.uploadFile({
                    file: Buffer.from(imageArray[i], 'base64'),
                    fileName: 'some.jpg'
                })
                files.push(InputMedia.photo(data))
            }}

            console.log(`длина files ${files.length}`)

            const extendedMessage = await findByUuid(uuid!, chatId) as message
            const humanReadable = getHumanReadableTime(extendedMessage.message.date)
            const addToText = await updateOrCreateBayanForChat(chatId, queue.messages[0].sender.id.toString(), username, imgLenght+1)

            console.log('и после формирования фоток')
           
            const data = await tg.uploadFile({
                file: Buffer.from(imageArray[imgLenght], 'base64'),
                fileName: 'some.jpg'
            })

            files.push(InputMedia.photo(data, {caption:  html`Если нет ни одной схожей фотки, то пропиши <br><code>/err </code> <br><br>Сообщение от @${username}<br>от ${humanReadable}<br><br>${addToText}`}))

            console.log('уже тут')
            return  await tg.replyMediaGroup(extendedMessage.message, files); 
        }




        let messageToAnswer: {files: InputMediaPhoto[], extendedMessage: message }[] = []


        for (const [index, value] of Object.entries(generalGroupId)) {
            const photosLenght = value.data.length

            let InputMediaPhoto: InputMediaPhoto[] = [];
            let uuidArray: string[] = []
            
            const message = findByUuid(value.data[0].uuid, chatId) as Promise<message>
      
            for (let i=0; i<photosLenght; i++) {
                const b64 = value.data[i].image
                
                if (imageArray.includes(b64)) continue
                imageArray.push(b64)
                const groupid = value.data[i].groupid
            
                const data = await tg.uploadFile({
                    file: Buffer.from(b64, 'base64'),
                    fileName: 'some.jpg'
                })

                const uuid = value.data[i].uuid
                
                // if (generalGroupId.has(groupid)) {
                //     let entry = generalGroupId.get(groupid)!
                //     entry.uplFile.push(data)
                //     entry.uuidArray.push(uuid)
                //     entry.message.push(message)
                // } else {
                //     generalGroupId.set(groupid, {uplFile: [data], uuidArray: [uuid], message: [message as Promise<message>]})
                // }
                console.log('файлинпут готов')
                let file: InputMediaPhoto
                if (i !== photosLenght-1) {
                    file = InputMedia.photo(data)
                } else {
                    const humanReadable = getHumanReadableTime((await message).message.date)
                    console.log(`длина баянов ${photosLenght}`)
                    const addToText = await updateOrCreateBayanForChat(chatId, queue.messages[0].sender.id.toString(), username, photosLenght)
                    file = InputMedia.photo(data, {caption: html`Если нет ни одной схожей фотки, то пропиши <br><code>/err </code> <br><br>Сообщение от @${username}<br>от ${humanReadable}<br><br>${addToText}`})
                }
                
                InputMediaPhoto.push(file)
                uuidArray.push(uuid)
            }

            console.log('InputMediaPhoto готов')
            // generalUUID.concat(uuidArray)
            
            messageToAnswer.push({files: InputMediaPhoto, extendedMessage: await message as message})   
        }
        

        for (let [index, value] of messageToAnswer.entries()) {
            await tg.replyMediaGroup(value.extendedMessage.message, value.files); 
        }
        // console.log(needToProcess)

        delete this.queues[chatId];
    }




  addMessage(message: Message) {
    const groupId = message.groupedId?.low ? message.groupedId.low  : 0;
    console.log(groupId)

    const chatId = message.chat.id

    if (!this.queues[chatId]) {
      this.queues[chatId] = {};
    }

    if (!this.queues[chatId][groupId]) {
      this.queues[chatId][groupId] = { messages: [], timer: undefined };
    }
    
    // Add the new message to the queue
    this.queues[chatId][groupId].messages.push(message);

    // Setup a timer for this groupId within chatId if it's not already set
    if (!this.queues[chatId][groupId].timer) {
      this.queues[chatId][groupId].timer = setTimeout(() => {
        //@ts-ignore
        this.processQueue(chatId, groupId);
        if (this.queues[chatId] && this.queues[chatId][groupId]) {
          delete this.queues[chatId][groupId].timer;
        }
      }, 1000); // Adjust the delay as needed
    } 
  }

}

export const processor = new ChatMessageProcessor();