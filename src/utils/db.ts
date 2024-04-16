import pg, { DatabaseError } from 'pg';
import { ErrorEntry, Settings, SomeErrors, UserStat, fileIdObject, message } from '../types/sometypes.js';
import { UUID } from 'crypto';
import { Message, User } from '@mtcute/node';
import { Attachment, ContextDefaultState, ExternalAttachment, MessageContext, PhotoAttachment } from 'vk-io';
import { generateRandomDigits } from '../bayan/sometodo.js';
const { Pool } = pg;


const pool = new Pool({
    user: 'postgres',
    host: 'localhost',        //for local enveriment from my local pc
    // host: 'tgbot-postgresql-1', // for docker to docker
    database: 'tgclient',
    password: '51kln00bfd54FTY',
    port: 5432,
});


export async function insertIntoPostgres(uuid: string, message: any, groupid: number | null, chatid: number, platform: string, fileid: string) {
  
  
  const query = `
    INSERT INTO message(uuid, message, groupid, chatid, platform, fileid)
    VALUES($1, $2, $3, $4, $5, $6)
  `

  try {
    await pool.query(query, [uuid, message, groupid, chatid, platform, fileid]);
  } catch (err) {
    console.error('Error inserting into PostgreSQL:', err);
    return null; // It's helpful to explicitly return null or some error indicator in case of failure
  }
}


export async function findByUuid(uuid: string, chatid: number): Promise<message|undefined> {
    const query = `
      SELECT * FROM message
      WHERE uuid = $1 and chatid = $2;
    `;

    try {
      const res = await pool.query<message>(query, [uuid, chatid]);
      return res.rows[0]
    } catch (err) {
      console.error('Error querying PostgreSQL:', err);
    }
}

export async function findByUuidAndSelectOnlyFileId(uuid: string, chatid: number): Promise<fileIdObject[]> {
    const query = `
      SELECT fileid FROM message
      WHERE uuid = $1 and chatid = $2;
    `;

    
    const res = await pool.query<fileIdObject>(query, [uuid, chatid]).catch(err => {throw new Error('жизнь сложная')}) ;
    return res.rows
    
}

export async function getMessagesByUUIDs(uuidArray: string[], chatid: number): Promise<message[]|undefined> {
  try {
    // Construct the query string with placeholders for the array
    const queryText = 'SELECT * FROM message WHERE uuid = ANY($1::uuid[]) and chatid = $2';

    // Execute the query with the UUID array as parameter
    const res = await pool.query<message>(queryText, [uuidArray, chatid]);

    // Return the rows from the query result
    return res.rows;
  } catch (err: any) {
    const error = err as DatabaseError
    console.error('Error executing query', error.stack);
    // throw error; // Rethrow the error for further handling
  }
}

export async function deleteFromMessage(): Promise<void|null> {
  const query = `
    delete from message
  `;

  try {
    await pool.query(query);
  } catch (err) {
    console.error('Error querying PostgreSQL:', err);
    return null;
  }
}

export async function deleteFromUSerStats(): Promise<void|null> {
  const query = `
    delete from userstat
  `;

  try {
    await pool.query(query);
  } catch (err) {
    console.error('Error querying PostgreSQL:', err);
    return null;
  }
}



export async function fetchDataByChatId(chatid: number): Promise<UserStat | null> {
  const query = `
    SELECT * FROM userstat
    WHERE chatid = $1;
  `;

  try {
    const res = await pool.query<UserStat>(query, [chatid]);
    const data = res.rows[0]; // Ensures function returns 'null' if no records are found.
    if (!data) {
      const queryInsert = `
        INSERT INTO userstat (chatid, bayan)
        VALUES ($1, '{}')  
        RETURNING *;
      `;
      const res = await pool.query<UserStat>(queryInsert, [chatid]);
      return res.rows[0]
    }
    
    return data
  } catch (err) {
    console.error('Error querying userstat:', err);
    return null; // Ensure a consistent return type in case of error.
  }
}


export async function updateBayanByChatId(chatid: number, newBayanData: { [userId: string]: { count: number; nickname: string; }; }): Promise<boolean> {
  const query = `
    UPDATE userstat
    SET bayan = $1
    WHERE chatid = $2;
  `;

  try {
    await pool.query<UserStat>(query, [newBayanData, chatid]);
    return true
  
  } catch (err) {
    console.error('Error updating userstat:', err);
    return false; // Indicates error
  }
}


export async function insertWithChatIdAndCount(
  message: Message | (Attachment<object, string> | ExternalAttachment<object, string>), 
  // message: number,
  chatid: number, 
  count: number, 
  userid: number,
  platform: string,
): Promise<UUID> {
  
  try {
    const queryText = 'INSERT INTO errors (message, chatid, count, userid, platform) VALUES ($1, $2, $3, $4, $5) RETURNING key;';
    //@ts-ignore
    if (platform === 'TG') {
      const res = await pool.query<ErrorEntry>(queryText, [(message as Message).id, chatid, count, userid, platform]);
      return res.rows[0].key as UUID;
    } else {
      const res = await pool.query<ErrorEntry>(queryText, [message as PhotoAttachment, chatid, count, userid, platform]);
      return res.rows[0].key as UUID;
    }

  } catch (err) {
    console.error('Error executing insertWithChatIdAndCount:', err);
    throw err; // Rethrow the error for further handling, if necessary
  }
}


export async function selectById(id: UUID): 
Promise<SomeErrors> {
  try {
    const queryText = 'SELECT chatid, count, message, platform FROM errors WHERE key = $1;';
    const res = await pool.query(queryText, [id]);
    // console.log('======================== репорт ошибки тут ========================')
    // console.log(res.rows[0])
    return res.rows[0]; // Return the first row (assuming id is unique)
  } catch (err) {
    console.error('Error executing selectById:', err);
    throw err; // Rethrow the error for further handling, if necessary
  }
}

export async function deleteById(id: UUID): Promise<void> {
  try {
    const queryText = 'DELETE from errors WHERE key = $1;';
    await pool.query(queryText, [id]);
  } catch (err) {
    console.error('Error executing selectById:', err);
    throw err; // Rethrow the error for further handling, if necessary
  }
}

export async function updateById(id: UUID, count: number): Promise<void> {
  try {
    console.log(`новый каунт ${count}`)
    const queryText = 'UPDATE errors SET count = $1 WHERE key = $2;';
    await pool.query<ErrorEntry>(queryText, [count, id]);
  } catch (err) {
    console.error('Error executing selectById:', err);
    throw err; // Rethrow the error for further handling, if necessary
  }
}

type UsernamesById = {
  [key: number]: string;
};

export async function insertSettings(tgchatid: null|number = null, chatid: number, username: UsernamesById, vkchatid: null|number  = null) {
  const insertQuery = `
    INSERT INTO settings (tgchatid, chatid, username, vkchatid)
    VALUES ($1, $2, $3::jsonb, $4)
    RETURNING chatid, username, should_create;
  `;

  const {rows} = await pool.query<Settings>(insertQuery, [tgchatid, chatid, username, vkchatid]);
  return rows[0];
}

interface QueryResult {
  count: number; // Assuming count is always returned as an integer
  bayan: {
    [userId: string]: { // The user ID as a string maps to an object containing both count and nickname
      count: number;
      nickname: string;
    };
  };
}
interface BayanEntry {
  count: number;
  nickname: string;
}

// Assuming the structure of the rows returned by your query
interface QueryResultRow {
  bayan: Record<string, BayanEntry>;
}
export async function updateSettings(chatid: number, username: UsernamesById, vkchatid: number, nickname: string, tgchatid: number) {
  
  await pool.query('BEGIN');


  const insertQuery = `
      UPDATE settings
      SET username = $1, vkchatid = $2
      WHERE chatid = $3
  `;
  try {
    await pool.query<Settings>(insertQuery, [username, vkchatid, chatid]);


    const selectQuery = `
      SELECT * from settings
      WHERE vkchatid = $1 and tgchatid IS NULL
    `
    const {rows} = await pool.query<Settings>(selectQuery, [vkchatid])

    const query = `
      DELETE from settings
      WHERE vkchatid = $1 and tgchatid IS NULL
    `;
    await pool.query<Settings>(query, [vkchatid])

    const selectUserStatQuery = `
    SELECT
      bayan->(SELECT jsonb_object_keys(bayan) FROM userstat WHERE chatid = $1 LIMIT 1)->>'count' AS count,
      chatid
    FROM
      userstat
    WHERE
      chatid = $1;
    `;

    const result = await pool.query(selectUserStatQuery, [rows[0].chatid]);
  
    if (result.rows.length > 0) {
      console.log('обновляю')
      console.log(result.rows[0])
      const count = Number(result.rows[0].count)
      console.log(`count is ${count}`)
      const tgchatidStr = tgchatid.toString();

      const currentBayanQuery = `
        WITH key_value_pairs AS (
          SELECT
            kv.key,
            kv.value,
            userstat.bayan as bayan,
            kv.value->>'nickname' AS extracted_nickname
          FROM 
            userstat,
            jsonb_each(userstat.bayan) AS kv(key, value)
          WHERE chatid = $1
        )
        SELECT bayan
        FROM key_value_pairs
        WHERE extracted_nickname = $2;
      `;

      const currentResult = await pool.query<QueryResult>(currentBayanQuery, [chatid, nickname]);

      console.log(currentResult.rows)
      if (currentResult.rows.length > 0) {
        const rows = currentResult.rows as QueryResultRow[];
        console.log(rows)
        let bayanToUpdate: Record<string, BayanEntry>;
        let keyToUpdate: string = '';

        rows.forEach(row => {
          console.log('++++')
          console.log(row)
          Object.entries(row.bayan).forEach(([key, entry]) => {
            if (entry.nickname === nickname) {
              bayanToUpdate = row.bayan;
              keyToUpdate = key;
            }
          });
        });
        
        const oldCount = bayanToUpdate![keyToUpdate!].count
        bayanToUpdate![keyToUpdate!].count =  oldCount + count;

        const updateBayanQuery = `
          UPDATE userstat
          SET bayan = $1
          WHERE chatid = ${chatid};
        `;

        console.log('перед обновлением')
        console.log(rows[0].bayan)
        await pool.query(updateBayanQuery, [rows[0].bayan]);

        const deleteQuery = `
          DELETE FROM userstat
          WHERE chatid = $1
        `
        
        await pool.query(deleteQuery, [result.rows[0].chatid]);
      }

    }

    await pool.query('COMMIT');

  } catch (e) {
    console.log(e)
    await pool.query('COMMIT');
  }
 
}

interface ChatIdParams {
  tgchatid?: number | null;
  vkchatid?: number | null;
  username?: string;
  userId: number;
}

export async function getUsernameJSON(nickname: string) {
  const updateQuery = `
    SELECT s.*
    FROM settings s, jsonb_each_text(s.username) AS kv
    WHERE kv.value = $1 AND s.vkchatid IS NULL;
  `;
  console.log(nickname)
  const {rows} = await pool.query<Settings>(updateQuery, [nickname]);
  return rows[0];
}

export async function getChatIdByPlatformId({ tgchatid = null, vkchatid = null, userId, username }: ChatIdParams) {
  const selectQuery = `SELECT chatid, username, should_create, vkchatid, tgchatid FROM settings WHERE tgchatid = $1 OR vkchatid = $2;`;
  const { rows } = await pool.query<Settings>(selectQuery, [tgchatid, vkchatid]);
  
  // if (!rows[0]?.username)  throw new Error('Forget setting username')
  const data = (tgchatid) ? tgchatid : vkchatid!
  if (!rows[0]?.chatid) {
    const random = generateRandomDigits(12)
    return await insertSettings(tgchatid, random, {[userId as number]: `@${username}`}, vkchatid)
  }

  const usernames = rows[0].username

  if (tgchatid && usernames && !usernames[userId]) {
    usernames[tgchatid] = `@${username}`
    rows[0].username = usernames
    console.log('creating new')
    console.log(rows[0].username)
    await updateSettingsWithUsername(data, rows[0].username)
  }

  // console.log('i am getting back new')
  return rows[0]
}


export async function updateSettingsNotification(vkchatid: number) {
  const updateQuery = `
      UPDATE settings
      SET should_create = False
      WHERE vkchatid = $1;
  `;
  await pool.query<Settings>(updateQuery, [vkchatid]);
}

export async function updateSettingsWithUsername(tgchatid: number, username: UsernamesById) {
  const updateQuery = `
      UPDATE settings
      SET username = $1
      WHERE tgchatid = $2;
  `;
  await pool.query<Settings>(updateQuery, [username, tgchatid]);
}

export async function updateSettingsWithVKChatId(tgchatid: number, vkchatid: number) {
  const updateQuery = `
      UPDATE settings
      SET vkchatid = $2
      WHERE tgchatid = $1;
  `;
  await pool.query(updateQuery, [tgchatid, vkchatid]);
}