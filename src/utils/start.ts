import weaviate, { WeaviateClient}  from 'weaviate-ts-client';
import { deleteFromMessage } from './db.js';

//@ts-ignore
export const client = weaviate.client({
  scheme: 'http',
  host: 'localhost:8080',
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
    ]
}
  

export async function gettAll(howMuch: number = 100) {
  try {
    const results = await client.graphql.get()
        .withClassName("Image")
        .withFields("image") // Specify the fields you want to retrieve
        .withLimit(howMuch) // Set a limit to the number of records to fetch
        .do();
    const array = results.data?.Get?.Image.map((el: {image: string}) => el.image.substring(0, 40))
    console.log(array)
  } catch (error) {
      console.error(`Error deleting class:`, error);
  }
}

export async function CreateClass(className: string) {
      try {
        await client.schema
          .classCreator()
          .withClass(schemaConfig)
          .do();
          console.log(`Class ${className} has successfull created.`);
      } catch (error) {
          console.error(`Error deleting class ${className}:`, error);
      }
}

export async function deleteClass(className: string) {
    try {
        await client.schema.classDeleter().withClassName(className).do();
        await deleteFromMessage()
        console.log(`Class ${className} and all its records have been deleted.`);
    } catch (error) {
        console.error(`Error deleting class ${className}:`, error);
    }
}