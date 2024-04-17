import { InputMedia, InputMediaPhoto, Message } from "@mtcute/node";
import { html } from "@mtcute/node";
import { NotifBot, tg } from "../utils/tgclient.js";
import { fetchDataByChatId, findByUuid, getChatIdByPlatformId, getMessagesByUUIDs, insertWithChatIdAndCount } from "../utils/db.js";
import { GeneralGroupId, UserStat, message } from "../types/sometypes.js";
import { generateRandomDigits, updateOrCreateBayanForChat } from "./sometodo.js";
import { createImageAndInsertIntoPostgres, searchImage } from "../utils/weaviate.js";
import { formatDateToReadable, getTelegramPhotoBase64, getVKPhotoBase64, platform, processMessageQueue } from "../utils/action.js";
import { Attachment, ContextDefaultState, ExternalAttachment, IUploadSourceMedia, MessageContext, PhotoAttachment, WallAttachment } from "vk-io";
import { vk } from "../utils/vkclient.js";




interface ProcessEntry {
    data: {images: string, uuid: string, groupid: number}[];
    count: number;
}

interface BaseQueueItem {
    timer?: NodeJS.Timeout;
    username: string;
    userid: number;
    chatIdtrue?: number;
}

interface TGQueueItem extends BaseQueueItem {
    platform: 'TG';
    messages: Message[]; // For TG, messages are of type Message[]
}

interface VKQueueItem extends BaseQueueItem {
    platform: 'VK';
    messages: PhotoAttachment[]; // For VK, messages are PhotoAttachments
}

type QueueItem = TGQueueItem | VKQueueItem;




class ChatMessageProcessor {
    // private queues: { [chatId: string]: { [groupedId: string]: QueueItem } };
    private queues: 
    { [chatId: string]: 
        { [groupedId: string]: 
            { 
                messages: (Message | PhotoAttachment)[];
                timer?: NodeJS.Timeout ;
                username: string;
                userid: number;
                platform: 'VK'|'TG'
                chatIdtrue: number|undefined;
                context?: MessageContext<ContextDefaultState> & object
                tgchatid?: number
            } 
        } 
    };
  
    constructor() {
      this.queues = {};
    }
  




    async processQueue(chatId: number, groupId: number) {

        const queue = this.queues[chatId]?.[groupId];
        delete this.queues[chatId];
        
        const queuArrayLenght = queue.messages.length

        const username = queue.username
        const userid = queue.userid
        console.log(`queue userid is ${userid}`)
        const localeplatform = queue.platform
        const chatIdtrue = queue.chatIdtrue as number
        // console.log('---------------------------------------------------------')
        // console.log(`-----------------groupId is ${groupId}-------------------`)
        // console.log('---------------------------------------------------------')

        const {generalGroupId, functionArray, breakFromLoop} = await processMessageQueue(queue.messages, chatIdtrue, groupId, queuArrayLenght, localeplatform, queue.context)

        if (functionArray.length>0) await Promise.all(functionArray.map(func => func()));
        console.log(generalGroupId)
        
        
        // if (breakFromLoop || Object.keys(generalGroupId).length === 1) {
        //     const procceedKey = Number(Object.keys(generalGroupId)[0])
        //     const allGroupPhoto = generalGroupId[procceedKey].data
        //     const photosLenght = allGroupPhoto.length
        //     const uuid = allGroupPhoto[0].uuid

        //     let files: (InputMediaPhoto|IUploadSourceMedia)[] = []
        //     let indexies: number[] = []

        //     const extendedMessage = await findByUuid(uuid!, chatIdtrue) as message
        //     extendedMessage.tgchatid = queue.tgchatid
        //     const addToText = await updateOrCreateBayanForChat(chatIdtrue, userid.toString(), username, photosLenght)
        //     const belongToPlatform: boolean = (allGroupPhoto[0].platform === localeplatform) ? true : false
        //     const platformForDate = allGroupPhoto[0].platform
        //     const date = platform[platformForDate].geFormatedDate(extendedMessage.message)
        //     const indstr = platform[localeplatform].makeText(allGroupPhoto, date, indexies)
        //     // console.log(`indexies is ${indexies}`)

        //     const erroruuid = await insertWithChatIdAndCount(allGroupPhoto[0].msg, chatIdtrue, photosLenght, userid, localeplatform)

        //     for (let i=0; i<photosLenght-1; i++) {{
        //         await platform[localeplatform].photoupload(files, allGroupPhoto[i].image)
        //     }}
        //     const text = platform[localeplatform].makeTextSecond(indexies.join(''), indstr, erroruuid, addToText)
        //     await platform[localeplatform].lastUploadPhoto(files, allGroupPhoto[photosLenght-1].image, text)

        //     return await platform[localeplatform].replyWithPlatform({context: queue.context, files: files, extendedMessage: extendedMessage, text: text as string, belongToPlatform})
        // }


        let imageUUID: string[] = []
        let generalIndex: number[] = []
        if (generalGroupId['0']?.data.length>1) {
            const newData = generalGroupId['0'].data;
            delete generalGroupId['0']; // Remove or transform this as needed
            
            newData.forEach((variant, index) => {
                generalGroupId[index + 1] = { count: 1, data: [variant] };
            });
        }
        console.log(`длина ${Object.entries(generalGroupId).length}`)
        // console.log(generalGroupId)

        for (const [index, value] of Object.entries(generalGroupId)) {
            const photosLenght = value.data.length
            const count = (queuArrayLenght === 1) ? 1 : photosLenght
            const platformForDate = value.data[0].platform
            const belongToPlatform: boolean = (value.data[0].platform === localeplatform) ? true : false
            // console.log(`длина текущей ${photosLenght}`)

            let pass = false 
            let files: (InputMediaPhoto|IUploadSourceMedia)[] = []
            let uniqueInds = new Set(value.data.map(val => val.ind));
            // let indexies = Array.from(uniqueInds);
            let indexies: number[] = []
            
            const extendedMessage = await findByUuid(value.data[0].uuid, chatIdtrue) as message
            if (!extendedMessage) continue
            extendedMessage.tgchatid = queue.tgchatid;

            // const date = platform[platformForDate].geFormatedDate(extendedMessage.time_creation);
            const date = formatDateToReadable(extendedMessage.time_creation);
            const indstr = platform[localeplatform].makeText(value.data, date, indexies)

            indexies.map((el: number) => {
                if (!generalIndex.includes(el)) {
                    pass = true
                    generalIndex.push(el)
                }
            })

            // console.log(value.data[0].msg)
            const erroruuid = (pass) ?  await insertWithChatIdAndCount(value.data[0].msg, chatIdtrue, count, userid, localeplatform) : ''
            // const [result] = await tg.getMessages(chatId, [extendedMessage.message.id]) // check if message exists
            const addToText = await updateOrCreateBayanForChat(chatIdtrue, userid.toString(), username, count, pass)
            const text = platform[localeplatform].makeTextSecond(indexies.join(''), indstr, erroruuid, addToText, pass)
            await platform[localeplatform].lastUploadPhoto(files, value.data[0].image, text)

            for (let i=1; i<photosLenght; i++) {
                const b64 = value.data[i].image
                if (imageUUID.includes(value.data[i].uuid)) continue
                imageUUID.push(value.data[i].uuid)
                // indexies.push(value.data[i].ind)
            
                await platform[localeplatform].photoupload(files, value.data[i].image)
            }
 
            await platform[localeplatform].replyWithPlatform({context: queue.context, files: files, extendedMessage: extendedMessage, text: text as string, belongToPlatform})
        }
        
    }






    async addTGMessage(message: Message) {
      
        const chatId = message.chat.id
        const groupId = message.groupedId?.low ? message.groupedId.low : 0;

        if (!this.queues[chatId]) {
            this.queues[chatId] = {};
        }

        if (!this.queues[chatId][groupId]) {
            this.queues[chatId][groupId] = { messages: [], timer: undefined, username: '', userid: 0, platform: 'TG', chatIdtrue: undefined };
        }
        
        this.queues[chatId][groupId].messages.push(message);

        if (groupId === 0) {
            const settingPromise = await getChatIdByPlatformId({ 
                tgchatid: chatId, 
                username: message.sender.username ?? message.sender.id.toString(),
                userId: message.sender.id
            });
            this.queues[chatId][groupId].username = 
                settingPromise.username?.[message.sender.id] ??  // Tries to get the username from settingsInfo using sender's ID
                message.sender.username ??  // Falls back to sender's username from the message
                (this.queues[chatId][groupId].messages[0] as Message).sender.id.toString();  // Uses the sender ID from the first message in the queue as the last resort
        
            this.queues[chatId][groupId].userid = message.sender.id
            this.queues[chatId][groupId].chatIdtrue = Number(settingPromise.chatid)
            this.queues[chatId][groupId].tgchatid = Number(settingPromise.tgchatid!)


            return this.processQueue(chatId, groupId);
        }

        if (!this.queues[chatId][groupId].timer) {
            const settingPromise = getChatIdByPlatformId({ 
                tgchatid: chatId, 
                username: message.sender.username ??  message.sender.id.toString(),
                userId: message.sender.id 
            });
        
            this.queues[chatId][groupId].timer = setTimeout(async () => {
                const settings = await settingPromise;
                this.queues[chatId][groupId].username = `@${(this.queues[chatId][groupId].messages[0] as Message).sender.username}` ?? (this.queues[chatId][groupId].messages[0] as Message).sender.id.toString();
                this.queues[chatId][groupId].userid = (this.queues[chatId][groupId].messages[0] as Message).sender.id;
                this.queues[chatId][groupId].tgchatid = Number(settings.tgchatid!)
                // console.log(`userid is ${this.queues[chatId][groupId].userid}`);
                
                const chatIdtrue = settings.chatid;
                this.queues[chatId][groupId].chatIdtrue = Number(chatIdtrue);
        
                await this.processQueue(chatId, groupId); // Adjust to ensure proper asynchronous execution
        
                if (this.queues[chatId] && this.queues[chatId][groupId]) {
                    delete this.queues[chatId][groupId].timer;
                }
            }, 1000); // Adjust the delay as needed
        }
    }


    async addVKMessage(context: MessageContext<ContextDefaultState> & object) {
        let photos = context.getAttachments('photo')
        if (photos.length === 0) {
            console.log('да ноль штук')
            // console.log(context.attachments)
            // console.log(context.attachments.constructor.name);
            context.attachments.forEach((el) => {
                if (el instanceof WallAttachment) {
                    console.log('да альбом с группы')
                    photos = el.attachments.map((el) => {
                        if (el instanceof PhotoAttachment) return el
                        
                    }) as PhotoAttachment[]
                }
            })
      
            
        }

        // console.log(`сейчас длина фото - ${photos.length}`)
        const chatId = context.peerId

        const settingPromise = await getChatIdByPlatformId(
            { 
                vkchatid: chatId,
                userId: context.senderId,
                username: context.senderId.toString()
            });

        console.log(settingPromise)
        
        const groupId = (photos.length>1) ? generateRandomDigits(9) : 0;
        let userId = (settingPromise.username) ? Number(settingPromise.username[context.senderId]) : context.senderId
        if (!userId ) userId = context.senderId

        this.queues[chatId] = {};
        
        if (!this.queues[chatId][groupId]) {
            this.queues[chatId][groupId] = 
            {
                messages: [], 
                timer: undefined, 
                username: settingPromise.username ? settingPromise.username[userId] : `${context.senderId}`, 
                userid: Number(userId),
                platform: 'VK',
                chatIdtrue: Number(settingPromise.chatid),
                context: context,
                tgchatid: Number(settingPromise.tgchatid!)
            };
        }

        let b64photos: string[] = []
        for (let photo of photos) {
            this.queues[chatId][groupId].messages.push(photo);
        }

        if (this.queues[chatId][groupId].messages.length>0) {
            let files: InputMediaPhoto[] = []
            for (let message of this.queues[chatId][groupId].messages) {
                const b64 = await getVKPhotoBase64(message as PhotoAttachment)
                // console.log(b64.substring(0, 80))
                const data = await NotifBot.uploadFile({
                    file: Buffer.from(b64, 'base64'),
                    fileName: 'some.jpg'
                })
                files.push(InputMedia.photo(data))
            }
            // console.log(files)
            await NotifBot.sendMediaGroup(433894487, files)
            await vk.api.messages.markAsRead({peer_id: context.peerId, mark_conversation_as_read: true})
        }
        // this.queues[chatId][groupId].messages.push(context);
        // console.log(settingPromise)
        
        await this.processQueue(chatId, groupId);
        if (settingPromise.should_create && !settingPromise.tgchatid) {
            await context.reply('Ты еще не привязал телеграм аккаунт. Чтобы установить связь, пропиши команду\n\n/set @nickname\n\nЧтобы больше не получать подобные уведомления, пропиши\n/set off')
        }
    }

}

export const processor = new ChatMessageProcessor();