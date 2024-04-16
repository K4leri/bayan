import { Message } from "@mtcute/node";
import { Attachment, ContextDefaultState, ExternalAttachment, MessageContext, PhotoAttachment } from "vk-io";

export interface message {
    id: number; // Since id is SERIAL, it's an auto-incremented integer
    uuid: string; // UUIDs are represented as strings in TypeScript
    message: number; // JSONB can be any type, but for more accurate typing, replace 'any' with a more specific type or interface that matches the expected structure of your JSONB column
    groupid: bigint; // BIGINT is also represented as a number in TypeScript; consider using string if precision is crucial and values may exceed JavaScript's safe integer limit
    firstmessageid: bigint; // Similarly, BIGINT is represented as a number
    time_creation: Date; // TIMESTAMP WITH TIME ZONE is best represented by JavaScript's Date object
    tgchatid?: number
}

export interface fileIdObject {
    fileid: string
}


export interface UserStat {
    id: number;
    chatid: bigint;
    bayan: {
      [userId: string]: { // The user ID as a string maps to an object containing both count and nickname
        count: number;
        nickname: string;
      };
    };
    time_creation: Date;
    last_update: Date;
}



export interface ErrorEntry {
  id: number; // Assuming SERIAL will be used as an integer
  key: string; // UUIDs are best represented as strings in TypeScript
  chatid: bigint; // BigInt in TypeScript, for large integers
  userid: bigint; // BigInt for consistency with chatid
  count?: number; // Optional since it's not specified as NOT NULL
  message: any; // JSONB can be any type, but typically structured as an object
  errorMessage: any; // Same as message, JSONB can hold any structured data
  time_creation: Date; // TIMESTAMP WITH TIME ZONE is best represented as a Date
  last_update: Date; // Same as time_creation
  platform: string;
}

export interface GeneralGroupId {
  [key: string]: {
      count: number;
      data: {
          image: string;
          uuid: string;
          groupid: number;
          msg: Message | (Attachment<object, string> | ExternalAttachment<object, string>);
          ind: number;
          platform: 'TG'|'VK';
      }[]
  };
}

export type UsernamesById = {
  [key: string]: string;
};

export interface Settings {
  id: number; // since SERIAL is an auto-incrementing integer
  chatid: number; // BIGINT for storing large integers
  tgchatid?: number | null; // BIGINT and can be UNIQUE, nullable because it might not be set initially
  vkchatid?: number | null; // Similar to tgchatid, UNIQUE, nullable
  should_create: boolean; // BOOLEAN, with a default value of TRUE
  firstmessageid?: number | null; // BIGINT, nullable because it might not be set initially
  time_creation: Date; // TIMESTAMP WITH TIME ZONE for storing time with timezone information
  last_update?: Date; // TIMESTAMP WITH TIME ZONE, might not be present immediately upon creation
  username?: UsernamesById
}

interface UsernameMap {
  [key: string]: string;
}

export interface Data {
  username?: UsernameMap;
  tgchatid: number;

  // other properties of `data`
}


export interface SomeErrors { 
  chatid: number; 
  count: number;
  message: number | PhotoAttachment;
  // message: Message | (Attachment<object, string> | ExternalAttachment<object, string>);
  platform: string;
  // fileid: string
}