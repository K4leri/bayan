import { Context, PhotoAttachment, Updates, VK } from 'vk-io';
import dotenv from 'dotenv';
dotenv.config();


export const vk = new VK({
    token: process.env.VK_TOKEN!
});



