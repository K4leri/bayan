import { InputMedia, InputMediaPhoto, Message, html } from "@mtcute/node";
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
      const imageMap = new Map<string, { count: number; data: message; InputMediaPhoto?: InputMediaPhoto[] }>();
      // const sameGroupIdMap = new Map<bigint, { data: Message }>();


      for (let [index, element] of bayan.entries()) {
        const allObjectData = data[index]
 
        if (element.hasImages) {
          shouldAnswer = true
          // console.log(allObjectData.data.Get.Image[0]._additional.id)

          const msg = allObjectData.data.message
          const maxArraySize = allObjectData.data.Get.Image.length - 1
          const imageArray = allObjectData.data?.Get?.Image
          let InputMediaPhoto: InputMediaPhoto[] = [];

          // let sameb64array: {image: string, message: Message}[] = []
          for (let [index, el] of imageArray.entries()) {
            const base64 = el.image
            if (!imageMap.has(base64)) {

              // console.log(base64.substring(0, 60))
              console.log(base64.slice(-60));
              const uuid = allObjectData.data.Get.Image[index]._additional.id //this is uuid from vector db
              // console.log(`uuid ${uuid}`)
              const imageData = await findByUuid(uuid)
              imageMap.set(base64, { count: 1, data: imageData! });
              // if (imageData) {
              //   // if (!sameGroupIdMap.has(imageData?.groupid)) {
              //   //   sameGroupIdMap.set(imageData.groupid, {data: imageData.message})
              //   // } 
              //   imageMap.set(b64, { count: 1, data: imageData });
              // }
              // else {
              //   continue
              // }
            } else {
              let entry = imageMap.get(base64)!;
              entry.count += 1;
              imageMap.set(base64, entry); // Update the count if duplicate
              continue
            }

            const data = await tg.uploadFile({
                file: Buffer.from(base64, 'base64'),
                fileName: 'some.jpg'
            })
            if (index !== maxArraySize) {
              InputMediaPhoto.push(InputMedia.photo(data))
            } else {
              InputMediaPhoto.push(InputMedia.photo(data, {caption: html`Если какая-либо из фотографий не совыпадает, то пропиши <code>/err</code>`}))
            }

            let entry = imageMap.get(base64)!;
            entry.InputMediaPhoto = InputMediaPhoto;
            imageMap.set(base64, entry); 
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

      if (shouldAnswer) {
        const groupsToSend = new Map<bigint, {msg: Message, InputMediaPhoto: InputMediaPhoto[]}>();

        for (const value of imageMap.values()) {
          const groupId = value.data.groupid; // Assuming groupId is bigint
          const photos = value.InputMediaPhoto!; // This is already InputMediaPhoto[]
      
          if (!groupsToSend.has(groupId)) {
              groupsToSend.set(groupId, { msg: value.data.message, InputMediaPhoto: photos });
          } else {
              let entry = groupsToSend.get(groupId)!;
              entry.InputMediaPhoto.push(...photos); 
          }
          
        }

        for (const value of groupsToSend.values()) {
          const message = value.msg
          await tg.replyMediaGroup(message, value.InputMediaPhoto); 
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