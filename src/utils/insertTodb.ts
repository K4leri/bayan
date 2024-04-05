import { insertIntoPostgres } from "./db.js";
import { client } from "./start.js";


export async function createImageAndInsertIntoPostgres(b64Image: string, message: any, groupId: number) {
    try {
        // Assuming 'client' is your Weaviate client instance
        const creationResult = await client.data.creator()
            .withClassName('Image')
            .withProperties({
                image: b64Image,
                chatid: message.chat.id,
                groupid: groupId
            })
            .do();

        const uuid = creationResult.id;

        if (!uuid) {
            console.error("Failed to create image in Weaviate.");
            return;
        }

        // Assuming 'insertIntoPostgres' is a function you've defined to insert the data into PostgreSQL
        await insertIntoPostgres(uuid, message, groupId, message.chat.id);

        console.log(`${message.chat.id} - Insertion successful`);

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
          }[];
        };
    }
}

export async function searchImage(b64: string, chatid: number, certainty: number, needToFind: number) {
    const result = await client.graphql.get()
        .withClassName('Image')
        .withFields('image groupid _additional {id}') // Include both 'id' and 'image' here
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
    
    return result
}

