import { platform } from "os";
import { insertIntoPostgres } from "./db.js";
import { client } from "./weaviatePerStart.js";
import { bot, botdp } from "./tgclient.js";
import { InputMedia, Photo } from "@mtcute/core";


export async function createImageAndInsertIntoPostgres(b64Image: string, message: number, groupId: number, platform: string, chatIdtrue: number) {
    try {
        const creationResult = await client.data.creator()
            .withClassName('Image')
            .withProperties({
                image: b64Image,
                chatid: chatIdtrue,
                groupid: groupId,
                platform: platform
            })
            .do();

        const uuid = creationResult.id;

        if (!uuid) {
            console.error("Failed to create image in Weaviate.");
            return;
        }

        const buffer = Buffer.from(b64Image, 'base64');
        const photo = InputMedia.photo(buffer, { fileName: 'image.png' })
        const data = await bot.uploadMedia(photo) as Photo

        // Assuming 'insertIntoPostgres' is a function you've defined to insert the data into PostgreSQL
        await insertIntoPostgres(uuid, message, groupId, chatIdtrue, platform, data.fileId);

        console.log(`${chatIdtrue} - Insertion successful`);

    } catch (err) {
        console.error('Error creating image and inserting into PostgreSQL:', err);
    }
}

interface ImageDataWithExtras {
    data : {
      Get: {
          Image: {
            _additional: { id: string };
            image: string;
            groupid: number;
            platform: 'TG'|'VK';
          }[];
        };
    }
}

export async function searchImage(b64: string, chatid: number, certainty: number, needToFind: number) {
    return await client.graphql.get()
        .withClassName('Image')
        .withFields('image groupid platform _additional {id}') // Include both 'id' and 'image' here
        // .withFields('image') // Include both 'id' and 'image' here
        .withNearImage({
            image: b64,
            certainty: certainty
        })
        .withWhere({
            operator: 'Equal',
            path: ['chatid'],
            valueInt: chatid // Replace `specificChatId` with the actual chat ID you're interested in.
        })
        // .withOffset(3)
        .withLimit(needToFind)
        .do() as ImageDataWithExtras
}

