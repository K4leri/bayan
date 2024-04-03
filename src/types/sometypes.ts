import { Message } from "@mtcute/node";

export interface message {
    id: number; // Since id is SERIAL, it's an auto-incremented integer
    uuid: string; // UUIDs are represented as strings in TypeScript
    message: Message; // JSONB can be any type, but for more accurate typing, replace 'any' with a more specific type or interface that matches the expected structure of your JSONB column
    groupid: bigint; // BIGINT is also represented as a number in TypeScript; consider using string if precision is crucial and values may exceed JavaScript's safe integer limit
    firstmessageid: bigint; // Similarly, BIGINT is represented as a number
    time_creation: Date; // TIMESTAMP WITH TIME ZONE is best represented by JavaScript's Date object
}