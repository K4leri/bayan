import { InputMedia, InputMediaPhoto, Message, TextWithEntities, html } from "@mtcute/node";
import { tg } from "./tgclient.js";
import { Attachment, ContextDefaultState, ExternalAttachment, IUploadSourceMedia, MessageContext, PhotoAttachment } from "vk-io";
import { createImageAndInsertIntoPostgres, searchImage } from "./weaviate.js";
import { GeneralGroupId, message } from "../types/sometypes.js";
import { findByUuid } from "./db.js";
import { joinTextWithEntities } from "@mtcute/core/utils.js";
import { BlobOptions } from "buffer";


export async function getTelegramPhotoBase64(message: Message) {
    // @ts-ignore
    const fileId = message.media.fileId;
    const chatId = message.chat.id; 
    const arrayBuffer = await tg.downloadAsBuffer(fileId);
  
    return Buffer.from(arrayBuffer).toString('base64');
}

export async function getVKPhotoBase64(photo: PhotoAttachment) {
    const response = await fetch(photo.largeSizeUrl!);
    const arrayBuffer = await response.arrayBuffer(); // Get the photo as an ArrayBuffer
    const buffer = Buffer.from(arrayBuffer); // Convert ArrayBuffer to Buffer
    return buffer.toString('base64')
}




export async function processMessageQueue(
    messages: (Message | (Attachment<object, string> | ExternalAttachment<object, string>))[], 
    chatId: number, 
    groupId: number, 
    queuArrayLenght: number,
    platform: string,
    context: MessageContext<ContextDefaultState> & object | undefined
) {
    const uuidArray: string[] = []
    const searchimageArray: string[]  = [];
    const functionArray: Function[] = []
    const generalGroupId: GeneralGroupId = {};
    const indexDone: number[] = []

    let breakFromLoop = false;
    let uploadb64: string[] = []
   

    for (let [index, message] of messages.entries()) {
        const b64: string = (platform === 'TG') 
            ? await getTelegramPhotoBase64(message as Message)
            : await getVKPhotoBase64(message as PhotoAttachment);

        
        let result = await searchImage(b64, chatId, 0.98, 1);
        const countResultFromVectorDB = result.data.Get.Image.length;
        console.log(`found - ${countResultFromVectorDB} variants in I try`)
        // console.log(result.data.Get.Image)
        if (countResultFromVectorDB > 0) {
            let pass = 0
            const uuid = result.data.Get.Image[0]._additional.id
            const localeplatform = result.data.Get.Image[0].platform as 'TG'|'VK'
            const image = result.data.Get.Image[0].image
            if (searchimageArray.includes(image)) continue
            searchimageArray.push(image)
            const groupId = result.data.Get.Image[0].groupid
            // console.log('---------------------------------------------------------')
            // console.log(`-----------------groupId is ${groupId}-------------------`)
            // console.log('---------------------------------------------------------')
            if (!generalGroupId[groupId]) {
                generalGroupId[groupId] = {count: 1, 
                    data:[{
                        image: image, 
                        uuid:  uuid, 
                        groupid: groupId, 
                        msg: message, 
                        ind: index, 
                        platform: localeplatform
                    }]
                }
            } else {
                generalGroupId[groupId].count = generalGroupId[groupId].count + 1
                generalGroupId[groupId].data.push({
                    image: image, 
                    uuid:  uuid, 
                    groupid: groupId, 
                    msg: message, 
                    ind: index,  
                    platform: localeplatform
                })
            }

            if (generalGroupId[groupId].count === queuArrayLenght) breakFromLoop = true
            indexDone.push(index)

        } else {
            console.log(`${index} - should be processed`);
            if (uploadb64.includes(b64)) continue
            if (platform === 'TG'){
                functionArray.push(() => createImageAndInsertIntoPostgres(b64, (message as Message).id, groupId, platform, chatId));
            } else {
                functionArray.push(() => createImageAndInsertIntoPostgres(b64, context!.id, groupId, platform, chatId));
            }
        }
    }

    for (let [index, message] of messages.entries()) {
        if (indexDone.includes(index)) continue
        console.log(`вновь обрабатываю ${index}`)
        const b64: string = (platform === 'TG') 
            ? await getTelegramPhotoBase64(message as Message)
            : await getVKPhotoBase64(message as PhotoAttachment);

        const result = await searchImage(b64, chatId, 0.94, 3)
        // const result = await searchImage(b64, chatId, 0.8, 10)

        const countResultFromVectorDB = result.data.Get.Image.length

        console.log(`${index} - результат второй проверки - ${countResultFromVectorDB}`)
        if (countResultFromVectorDB>0) {
            let pass = 0
            // const uuid = result.data.Get.Image[0]._additional.id

            for (let i=0; i<countResultFromVectorDB; i++) {
                const localeplatform = result.data.Get.Image[i].platform
                const uuid2 = result.data.Get.Image[i]._additional.id
                const image = result.data.Get.Image[i].image
                if (uuidArray.includes(uuid2)) continue
                uuidArray.push(uuid2)
                pass++
                const groupId = result.data.Get.Image[i].groupid

                if (!generalGroupId[groupId]) {
                    generalGroupId[groupId] = {
                        count: 1, 
                        data:[{
                            image: image, 
                            uuid:  uuid2, 
                            groupid: groupId, 
                            msg: message, 
                            ind: index, 
                            platform: localeplatform
                        }]
                    }
                } else {
                    generalGroupId[groupId].count = generalGroupId[groupId].count + 1
                    generalGroupId[groupId].data.push({
                        image: image, 
                        uuid:  uuid2, 
                        groupid: groupId, 
                        msg: message, 
                        ind: index,  
                        platform: localeplatform
                    })
                }
                
            }

            if (pass) functionArray.splice(index, 1)
        }
    }

    // console.log(generalGroupId)
    // throw new Error()
    return {generalGroupId, functionArray, breakFromLoop}
}


async function tguploadPhoto(files: InputMediaPhoto[], b64: string) {
    const data = await tg.uploadFile({
        file: Buffer.from(b64, 'base64'),
        fileName: 'some.jpg'
    })
    files.push(InputMedia.photo(data))
}

async function vkuploadPhoto(files: IUploadSourceMedia[], b64: string) {
    files.push({value: Buffer.from(b64, 'base64')})
}

export function formatDateToReadable(date: Date, shouldRework: boolean = false): string {
    const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "long",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: 'h23' // Ensures 24-hour format is used
    };

    // const dateObj = (shouldRework) ? new Date(date as number*1000) : new Date(date);;
    return new Intl.DateTimeFormat('ru-RU', options).format(date);
}

function isMessage(message: any) {
    return 'date' in message;
}
function isPhotoAttachment(message: any): message is PhotoAttachment {
    return 'attachments' in message
}

function getDateFromMessage(date: Date) {
    return formatDateToReadable(date);
    // if (isMessage(message)) {
    //     return formatDateToReadable(message.date);
    // } else if (isPhotoAttachment(message)) {
    //     return formatDateToReadable(message.createdAt!, true);
    // }
    // return "Date not available";
}

interface PlatformOperations {
    photoupload: (files: any[], b64: string) => Promise<void>;
    lastUploadPhoto: (files: any[], b64: string, text: any) => Promise<void>;
    replyWithPlatform: ({context, files, extendedMessage}: {files: any[], extendedMessage: message, context: (MessageContext<ContextDefaultState> & object) | undefined, text: string, belongToPlatform: boolean }) => Promise<void>;
    // geFormatedDate: (Date: Date) => string
    makeText: (allGroupPhoto: GeneralGroupId[string]['data'], date: string, indexies: number[]) => string|TextWithEntities
    makeTextSecond: (indexies: string, indstr: TextWithEntities|string, erroruuid: string, addToText: string, pass: boolean) => string|TextWithEntities
}

export const platform: Record<"VK" | "TG", PlatformOperations> = {
    VK: {
        photoupload: vkuploadPhoto,
        lastUploadPhoto: vkuploadPhoto,
        replyWithPlatform: async ({context, files, extendedMessage, text, belongToPlatform}: {context: (MessageContext<ContextDefaultState> & object) | undefined, files: IUploadSourceMedia[], extendedMessage: message, text: string, belongToPlatform: boolean}) => {
            await context!.sendPhotos(files, {message: text})
        },
        // geFormatedDate: getDateFromMessage,
        makeText: (allGroupPhoto: GeneralGroupId[string]['data'], date: string, indexies: number[]) => {
            return allGroupPhoto.map(element => {
                if (!indexies.includes(element.ind + 1)) indexies.push(element.ind + 1);
                return `${element.ind+1} - ${element.platform} - ${date}`
            }).join('\n')
        },
        makeTextSecond: (indexies: string, indstr: TextWithEntities|string, erroruuid: string, addToText: string, pass: boolean) => {
            return `Схожие фотки: ${indexies}\u2009\n${indstr}${(pass) ? `\n\nЕсли нет ни одной схожей фотки, то пропиши\n/err ${erroruuid}\n\n${addToText}` : ''}`
        }
    },
    TG: {
        photoupload: tguploadPhoto,
        lastUploadPhoto: async (files: InputMediaPhoto[], b64: string, text: TextWithEntities) => {
            const uploadFile = await tg.uploadFile({
                file: Buffer.from(b64, 'base64'),
                fileName: 'some.jpg'
            })

            files.push(InputMedia.photo(uploadFile, {caption: text}))
        },
        replyWithPlatform: async ({context, files, extendedMessage, text, belongToPlatform}: {files: InputMediaPhoto[], extendedMessage: message, context: (MessageContext<ContextDefaultState> & object) | undefined, text: string, belongToPlatform: boolean }) => {
            if (belongToPlatform) {
                await tg.sendMediaGroup(extendedMessage.tgchatid!, files, {replyTo: extendedMessage.message})
            } else {
                await tg.sendMediaGroup(extendedMessage.tgchatid!, files); 
            }
        },
        // geFormatedDate: getDateFromMessage,
        makeText: (allGroupPhoto: GeneralGroupId[string]['data'], date: string, indexies: number[]) => {
            return joinTextWithEntities(allGroupPhoto.map(element => {
                if (!indexies.includes(element.ind + 1)) indexies.push(element.ind + 1);
                return html`<code>${element.ind+1}</code> - ${element.platform} - ${date}`
            }), html`<br>`);
        },
        makeTextSecond: (indexies: string, indstr: TextWithEntities|string, erroruuid: string, addToText: string, pass: boolean) => {
            return html`Схожие фотки: <code>${indexies}</code>\u2009<br>${indstr}${(pass) ? html`<br><br>Если нет ни одной схожей фотки, то пропиши <br><code>/err ${erroruuid}</code><br><br>${html(addToText)}` : ''}`
        }
     },
}