import weaviate, { WeaviateClient}  from 'weaviate-ts-client';
import { deleteFromMessage, deleteFromUSerStats } from './db.js';
import { tg } from './tgclient.js';
import { InputMedia, InputMediaPhoto } from '@mtcute/node';

//@ts-ignore
export const client = weaviate.client({
  scheme: 'http',
  // host: 'localhost:8080', //for local enveriment from my local pc
  host: 'weaviate:8080', // for docker to docker
}) as WeaviateClient;

const schemaConfig = {
    'class': 'Image',
    'vectorizer': 'img2vec-neural',
    'vectorIndexType': 'hnsw',
    'moduleConfig': {
      'img2vec-neural': {
        'imageFields': [
          'image'
        ]
      }
    },
    'properties': [
      {
        'name': 'image',
        'dataType': ['blob'] // This will store the actual image data
      },
      {
          'name': 'text',
          'dataType': ['string']
      },
      {
          'name': 'chatid',
          'dataType': ['int']
      },
      {
          'name': 'groupid',
          'dataType': ['int']
      },
    ]
}
  

export async function gettAll(howMuch: number = 100) {
  try {
    const results = await client.graphql.get()
        .withClassName("Image")
        .withFields("image _additional { creationTimeUnix, id }") // Specify the fields you want to retrieve
        .withLimit(howMuch) // Set a limit to the number of records to fetch
        .withSort([{ path: ['_creationTimeUnix'] }])
        .do();
    const array = results.data?.Get?.Image.map((el: {image: string, _additional: {creationTimeUnix: Date, id: string}}) => {
      return {image: el.image/*el.image.substring(0, 40)*/, time: el._additional.creationTimeUnix, uuid: el._additional.id}
    })

    // array.map((el) =>{
    //   console.log(el.uuid)
    // })


    // const lastThreeElements = array.slice(-10);
    // let InputMediaPhoto: InputMediaPhoto[] = [];
    // for (let i=0; i<lastThreeElements.length; i++) {
    //   const b64 = lastThreeElements[i].image
    //   const data = await tg.uploadFile({
    //     file: Buffer.from(b64, 'base64'),
    //     fileName: 'some.jpg'
    //   })
    //   console.log('после фотки')
    //   const file = InputMedia.photo(data)
    //   InputMediaPhoto.push(file)

    // }
    // // console.log(InputMediaPhoto)
    // console.log('не смог отправить')
    // await tg.sendMediaGroup('me', InputMediaPhoto); 


  } catch (error) {
      console.error(error);
  }
}

export async function CreateClass(className: string) {
  try {
    // Attempt to get the class
    const existingClass = await client.schema
      .classGetter()
      .withClassName("Image")
      .do();

    // If the class exists, log a message or handle accordingly
    // console.log(`Class ${className} already exists.`);
    console.log(existingClass)
  } catch (error: any) {
    // If the class does not exist (404 error), create the class
    if (error.message.includes('404')) {
      try {
        console.log('Создаю класс')
        // Attempt to create the class
        await client.schema
          .classCreator()
          .withClass(schemaConfig)
          .do();
        console.log(`Class ${className} created successfully.`);
      } catch (creationError) {
        // Handle any errors that occur during class creation
        console.error(`Error creating class ${className}:`, creationError);
      }
    } else {
      // If the error is not a 404, log or handle it as needed
      console.error(`Error fetching class ${className}:`, error);
    }
  }
}


export async function deleteClass(className: string, uuid: string|undefined = undefined) {
    try {
      if (uuid) {
        await client.data.deleter()
          .withClassName(className)
          .withId(uuid)
          .do();
        return
      }
        await client.schema.classDeleter().withClassName(className).do();
        await deleteFromMessage()
        await deleteFromUSerStats()
        console.log(`Class ${className} and all its records have been deleted.`);
    } catch (error) {
        console.error(`Error deleting class ${className}:`, error);
    }
}