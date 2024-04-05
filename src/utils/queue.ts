//@ts-nocheck

import { InputMedia, InputMediaPhoto, Message, UploadedFile, html } from "@mtcute/node";
import { client } from "./weaviatePerStart.js";
import { tg } from "./tgclient.js";
import { fetchDataByChatId, findByUuid, getMessagesByUUIDs, insertIntoPostgres, updateBayanByChatId } from "./db.js";
import { BlobOptions } from "buffer";
import { UserStat, message } from "../types/sometypes.js";
import { getHumanReadableTime } from "../bayan/sometodo.js";

interface ImageDataWithExtras {
  b64: string;
  message: Message;
  Get: {
    Image: {
      _additional: { id: string };
      image: string;
    }[];
  };
  chatid: number;
}
  
class ChatMessageProcessor {
    private queues: { [chatId: string]: { [groupedId: string]: { messages: Message[]; timer?: NodeJS.Timeout } } };
  
    constructor() {
      this.queues = {};
    }
  




    async processQueue(chatId: number, groupId: number) {
      // Example: Process messages for a specific chatId
      console.log('начал выполнять')
      const queue = this.queues[chatId]?.[groupId];
      if (!queue) {
        console.log('вернулся без очереди')
        return
      }
  
      const queuArrayLenght = queue.messages.length
      console.log(`Processing ${queuArrayLenght} messages for chat ${chatId}`);

      let data: ImageDataWithExtras[] = [];
      let countPhotos: number = 0
      const groupIdMap = new Map()
      const imageArray: string[]  = [];
      let fullGroupById: false|bigint|number = false


      
      for (const msg of queue.messages) {
        //@ts-ignore
        const fileid = msg.media.fileId;
        const chatid = msg.chat.id
        const arrayBuffer = await tg.downloadAsBuffer(fileid);
        const b64 = Buffer.from(arrayBuffer).toString('base64');
        console.log(`chatid - ${chatid}`)
        const result = await client.graphql.get()
          .withClassName('Image')
          .withFields('image groupid _additional {id}') // Include both 'id' and 'image' here
          // .withFields('image') // Include both 'id' and 'image' here
          .withNearImage({
            image: b64,
            certainty: 0.92
          })
          .withWhere({
            operator: 'Equal',
            path: ['chatid'],
            valueInt: chatid // Replace `specificChatId` with the actual chat ID you're interested in.
          })

          .withLimit(5)
          .do()
        
        // console.log(result.data.Get.Image)
        const imageDataWithExtras: ImageDataWithExtras = {
          b64: b64,
          message: msg, // Ensure 'msg' has the correct type 'Message'
          Get: result.data.Get, // Adjust according to the actual structure of 'result'
          chatid: chatid
        }

        const uuidArray: string[] = [];
        
        console.log(`нашел количество фоток - ${result.data.Get.Image.length}`)
        const mappingResult: true|undefined = result.data.Get.Image.some((el: {_additional: {id: string}, image: string}) => {
          uuidArray.push(el._additional.id);
          if (!/* The above code appears to be a comment block in TypeScript. It mentions an
          `imageArray` variable and a question about its purpose, but the actual code or logic
          is not provided within the comment block. */
          imageArray.includes(el.image)) {
            imageArray.push(el.image);
            console.log('вышел')
            return queuArrayLenght === imageArray.length; // Will stop iterating once this is true
          }
        });

        const responce = await getMessagesByUUIDs(uuidArray, chatid)
        responce?.map((el) => {
          const localGroupId = el.message.groupedId?.low
          if (!groupIdMap.has(localGroupId)) {
            groupIdMap.set(localGroupId, {message: el.message, count: 1, imageInfo: imageArray})
          } else {
            let entry = groupIdMap.get(localGroupId)!
            entry.count += 1
            groupIdMap.set(localGroupId, entry)
          }
        })

        data.push(imageDataWithExtras);

        if (mappingResult) {
          fullGroupById = Number(responce![0].groupid)
          break
        }
      } 
        
      // console.log(groupIdMap)
      
      const bayan = data.map((el: any, index: number) => {
        return {
          index: index,
          hasImages: el.Get?.Image?.length
        };
      });
  

      let shouldAnswer: boolean = false
      // const imageMap = new Map<string, { count: number; data: message; InputMediaPhoto?: InputMediaPhoto[] }>();
      const imageMap = new Map<string, { count: number; }>();
      // const sameGroupIdMap = new Map<bigint, { data: Message }>();
      const imageDataMap = new Map<number, any>()


      // const uuidArray = bayan.Get.Image.map((el) => el._additional.id)
      if (fullGroupById) {
        console.log('да я единственная в группе')
        const mapData = groupIdMap.get(fullGroupById)
        const maxArraySize = mapData.imageInfo.length
        const message = mapData.message as Message

        const bayanMeter = await fetchDataByChatId(message.chat.id)! as UserStat;
        const bayanData = bayanMeter.bayan;
        const userIdStr = queue.messages[0].sender.id.toString();

        if (!bayanData[userIdStr]) {
          bayanData[userIdStr] = { count: queuArrayLenght, nickname: `@${message.sender.username}` ?? message.sender.id.toString() }
        } else {
          bayanData[userIdStr].count = bayanData[userIdStr].count + queuArrayLenght 
        }
        await updateBayanByChatId(chatId, bayanData)
        
        // console.log(mapData)
        let allMediaFiles: InputMediaPhoto[] = []
        for (let i=0; i<maxArraySize; i++) {
          const temp = await tg.uploadFile({
            file: Buffer.from(mapData.imageInfo[i], 'base64'),
            fileName: 'some.jpg'
          })
          if (i === maxArraySize-1) {
            console.log('да я фотка единственная')
            const humanReadable = getHumanReadableTime(mapData.message.date)
            
            const bayanArray = Object.entries(bayanData);
            const sortedBayanArray = bayanArray.sort((a, b) => b[1].count - a[1].count);
            const formattedStrings = sortedBayanArray.map(([userId, {nickname, count}]) => `${nickname}: ${count}`).join('<br>');
            
            const file = InputMedia.photo(temp, {
              caption: html`Если нет ни одной схожей фотки, то пропиши <br><code>/err </code> <br><br>Сообщение от @${message.sender.username}<br>от ${humanReadable}<br><br>${formattedStrings}`
            })
            
            allMediaFiles.push(file)
          } else {
            const file = InputMedia.photo(temp)
            allMediaFiles.push(file)
          }
          
        }

        
        await tg.replyMediaGroup(message, allMediaFiles);
        // console.log('ответил как группа')
        return
      }
      // for (let elem of data2!) {
        
      //   console.log(elem.message.groupedId)
      //   // await tg.replyText(elem.message, `${index} - сюда`)
      // }
      
      for (let [index, element] of bayan.entries()) {
        const allObjectData = data[index]
        

        
        if (element.hasImages) {
          shouldAnswer = true
          // console.log(allObjectData.data.Get.Image[0]._additional.id)

          // const msg = allObjectData.data.message
          // const maxArraySize = allObjectData.data.Get.Image.length - 1
          const imageArray = allObjectData.Get?.Image

          console.log(`${index} - длина массива ${imageArray.length}`)
          let InputMediaPhoto: UploadedFile[] = [];

          for (let [index, el] of imageArray.entries()) {
            const base64 = el.image
            if (imageMap.has(base64)) {
              continue
            } 
            
            imageMap.set(base64, {count: 1})

            const data = await tg.uploadFile({
                file: Buffer.from(base64, 'base64'),
                fileName: 'some.jpg'
            })
            
            InputMediaPhoto.push(data)
          }

          console.log(`${index} - длина InputMediaPhoto: ${InputMediaPhoto.length}`)
          if (InputMediaPhoto.length>0) { 
   
            // console.log(data)
            const uuid = allObjectData.Get.Image[0]._additional.id //this is uuid from vector db
            const imageData = await findByUuid(uuid, allObjectData.chatid)
            // imageMap.set(base64, { count: 1, data: imageData!, InputMediaPhoto: InputMediaPhoto });
            imageDataMap.set(index, {InputMediaPhoto: InputMediaPhoto, imageData: imageData })
          }
          

        } else {
          console.log(`${index} - Insertion successful`);
          const chatid = queue.messages[0].chat.id
          
          const result = await client.data.creator()
            .withClassName('Image')
            .withProperties({
              image: allObjectData.b64,
              chatid: allObjectData.chatid,
            })
            .do();

          const firstMessageGroupId = queue.messages[0].id
          await insertIntoPostgres(result.id!, allObjectData.message, (!isNaN(groupId)) ? groupId : null, firstMessageGroupId, chatid)
        }
      }
      // console.log(imageMap)

      if (shouldAnswer) {
        const groupsToSend = new Map<bigint, {msg: Message, InputMediaPhoto: UploadedFile[]}>();

        for (const value of imageDataMap.values()) {
          const groupId = value.imageData.groupid; // Assuming groupId is bigint
          const photos = value.InputMediaPhoto!; // This is already InputMediaPhoto[]
          
          console.log(`длина фоток сейчас: ${photos.length}`)

          if (!groupsToSend.has(groupId)) {
              groupsToSend.set(groupId, { msg: value.imageData.message, InputMediaPhoto: photos });
          } 
          else {
              let newEntry = groupsToSend.get(groupId)!;
              newEntry.InputMediaPhoto.push(...photos);
          }
          
        }

        // const userIdStr = queue.messages[0].sender.id;
        // const bayanMeter = await fetchDataByChatId(groupsToSend[userIdStr].msg.chat.id)! as UserStat;
        // const bayanData = bayanMeter.bayan;

        // if (!bayanData[userIdStr]) {
        //   bayanData[userIdStr] = { count: queuArrayLenght, nickname: `@${message.sender.username}` ?? message.sender.id.toString() }
        // } else {
        //   bayanData[userIdStr].count = bayanData[userIdStr].count + queuArrayLenght 
        // }
        // await updateBayanByChatId(chatId, bayanData)


        for (const value of groupsToSend.values()) {
          const message = value.msg
          const maxArraySize = value.InputMediaPhoto.length-1
          const file = value.InputMediaPhoto.map((el: UploadedFile, index: number) => {
            if (index === maxArraySize) {
              const humanReadable = getHumanReadableTime(message.date)
              
              return InputMedia.photo(el, {
                caption: html`Если нет ни одной схожей фотки, то пропиши <br><code>/err </code> <br><br>Сообщение от @${message.sender.username}<br>от ${humanReadable}`
              })
            } else {
              return InputMedia.photo(el)
            }
          })
          
          await tg.replyMediaGroup(message, file); 
        }

    }

    delete this.queues[chatId];
  }




  addMessage(message: Message) {
    const groupId = message.groupedId?.low ? message.groupedId.low  : 'ungrouped';
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