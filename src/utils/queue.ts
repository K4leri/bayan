import { InputMedia, InputMediaPhoto, Message, UploadedFile, html } from "@mtcute/node";
import { client } from "./start.js";
import { tg } from "./tgclient.js";
import { findByUuid, insertIntoPostgres } from "./db.js";
import { BlobOptions } from "buffer";
import { message } from "../types/sometypes.js";


  
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

      let data: any = []

      for (const msg of queue.messages) {
        //@ts-ignore
        const fileid = msg.media.fileId;
        const arrayBuffer = await tg.downloadAsBuffer(fileid);
        const b64 = Buffer.from(arrayBuffer).toString('base64');
        
        const result = await client.graphql.get()
          .withClassName('Image')
          .withFields('image _additional {id}') // Include both 'id' and 'image' here
          .withNearImage({
            image: b64, 
            certainty: 0.95
          })
          .withLimit(5)
          .do()
        
        result.data.message = msg
        result.data.b64 = b64
        data.push(result);
      } 
        


      const bayan = data.map((el: any, index: number) => {
        return {
          index: index,
          hasImages: el.data?.Get?.Image?.length
        };
      });
     
      


      let shouldAnswer: boolean = false
      // const imageMap = new Map<string, { count: number; data: message; InputMediaPhoto?: InputMediaPhoto[] }>();
      const imageMap = new Map<string, { count: number; }>();
      // const sameGroupIdMap = new Map<bigint, { data: Message }>();
      const imageDataMap = new Map<string, any>()

      for (let [index, element] of bayan.entries()) {
        const allObjectData = data[index]
 
        if (element.hasImages) {
          shouldAnswer = true
          // console.log(allObjectData.data.Get.Image[0]._additional.id)

          const msg = allObjectData.data.message
          const maxArraySize = allObjectData.data.Get.Image.length - 1
          const imageArray = allObjectData.data?.Get?.Image

          console.log(`${index} - длина массива ${imageArray.length}`)
          let InputMediaPhoto: UploadedFile[] = [];
          // let InputMediaPhoto: InputMediaPhoto[] = [];
          console.log(InputMediaPhoto)
          // let sameb64array: {image: string, message: Message}[] = []
          for (let [index, el] of imageArray.entries()) {
            const base64 = el.image
            if (!imageMap.has(base64)) {
              imageMap.set(base64, {count: 1})
            } else {
              let entry = imageMap.get(base64)!;
              entry.count += 1;
              imageMap.set(base64, entry); // Update the count if duplicate
              console.log('должен был продолжить и не добавлять вторую фотку')
              continue
            }

            const data = await tg.uploadFile({
                file: Buffer.from(base64, 'base64'),
                fileName: 'some.jpg'
            })
            console.log(`${index} - Добавляю фотку `)
            InputMediaPhoto.push(data)
            // InputMediaPhoto.push(InputMedia.photo(data, {caption: html`Если какая-либо из фотографий не совыпадает, то пропиши <code>/err</code>`}))
            // if (index !== maxArraySize) {
            //   InputMediaPhoto.push(InputMedia.photo(data))
            // } else {
            //   InputMediaPhoto.push(InputMedia.photo(data, {caption: html`Если какая-либо из фотографий не совыпадает, то пропиши <code>/err</code>`}))
            // }

           
            // console.log(entry.InputMediaPhoto)
          }

          console.log(`${index} - длина InputMediaPhoto: ${InputMediaPhoto.length}`)
          if (InputMediaPhoto.length>0) {
            const uuid = allObjectData.data.Get.Image[0]._additional.id //this is uuid from vector db
            const imageData = await findByUuid(uuid)
            // imageMap.set(base64, { count: 1, data: imageData!, InputMediaPhoto: InputMediaPhoto });
            imageDataMap.set(index, {InputMediaPhoto: InputMediaPhoto, imageData: imageData })
          }
          

        } else {
          console.log(`${index} - Insertion successful`);
          
          const result = await client.data.creator()
            .withClassName('Image')
            .withProperties({
              image: allObjectData.data.b64,
            })
            .do();

          const firstMessageGroupId = queue.messages[0].id
          await insertIntoPostgres(result.id!, allObjectData.data.message, groupId, firstMessageGroupId)
        }
      }
      // console.log(imageMap)

      if (shouldAnswer) {
        const groupsToSend = new Map<bigint, {msg: Message, InputMediaPhoto: UploadedFile[]}>();

        console.log(imageDataMap)

        for (const value of imageDataMap.values()) {
          const groupId = value.imageData.groupid; // Assuming groupId is bigint
          const photos = value.InputMediaPhoto!; // This is already InputMediaPhoto[]
          
          console.log(`длина фоток сейчас: ${photos.length}`)

          if (!groupsToSend.has(groupId)) {
              groupsToSend.set(groupId, { msg: value.imageData.message, InputMediaPhoto: photos });
          } else {
              let newEntry = groupsToSend.get(groupId)!;
              newEntry.InputMediaPhoto.push(...photos); 
          }
          
        }

        for (const value of groupsToSend.values()) {
          const message = value.msg
          const maxArraySize = value.InputMediaPhoto.length-1
          const file = value.InputMediaPhoto.map((el: UploadedFile, index: number) => {
            if (index === maxArraySize) {
              return InputMedia.photo(el, {caption: html`Если какая-либо из фотографий не совыпадает, то пропиши <code>/err</code>`})
            } else {
              return InputMedia.photo(el)
            }
          })
          
          await tg.replyMediaGroup(message, file); 
        }

        // for (const value of imageMap.values()) {
        //   const groupId = value.data.groupid; // Assuming groupId is bigint
        //   const photos = value.InputMediaPhoto!; // This is already InputMediaPhoto[]
          
        //   console.log(`длина фоток сейчас: ${photos.length}`)

        //   if (!groupsToSend.has(groupId)) {
        //       groupsToSend.set(groupId, { msg: value.data.message, InputMediaPhoto: photos });
        //   } else {
        //       let newEntry = groupsToSend.get(groupId)!;
        //       newEntry.InputMediaPhoto.push(...photos); 
        //   }
          
        // }

        // for (const value of groupsToSend.values()) {
        //   const message = value.msg
        //   await tg.replyMediaGroup(message, value.InputMediaPhoto); 
        // }
  
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