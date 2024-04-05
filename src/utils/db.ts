import pg, { DatabaseError } from 'pg';
import { ErrorRecord, UserStat, message } from '../types/sometypes.js';
import { UUID } from 'crypto';
const { Pool } = pg;


const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'tgclient',
    password: '51kln00bfd54FTY',
    port: 5432,
});


export async function insertIntoPostgres(uuid: string, message: any, groupid: number | null, chatid: number) {
  
  
  const query = `
    INSERT INTO message(uuid, message, groupid, chatid)
    VALUES($1, $2, $3, $4)
  `

  try {
    await pool.query(query, [uuid, message, groupid, chatid]);
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


export async function insertWithChatIdAndCount(chatid: number, count: number, userid: number): Promise<UUID> {
  try {
   
    const queryText = 'INSERT INTO errors (chatid, count, userid) VALUES ($1, $2, $3) RETURNING id;';
    const res = await pool.query(queryText, [chatid, count, userid]);

    return res.rows[0].id;
  } catch (err) {
    console.error('Error executing insertWithChatIdAndCount:', err);
    throw err; // Rethrow the error for further handling, if necessary
  }
}


export async function selectById(id: UUID): Promise<{ chatid: number; count: number }> {
  try {
    const queryText = 'SELECT chatid, count FROM errors WHERE id = $1;';
    const res = await pool.query(queryText, [id]);
    return res.rows[0]; // Return the first row (assuming id is unique)
  } catch (err) {
    console.error('Error executing selectById:', err);
    throw err; // Rethrow the error for further handling, if necessary
  }
}

export async function deleteById(id: UUID): Promise<void> {
  try {
    const queryText = 'DELETE from errors WHERE id = $1;';
    await pool.query(queryText, [id]);
  } catch (err) {
    console.error('Error executing selectById:', err);
    throw err; // Rethrow the error for further handling, if necessary
  }
}

export async function updateById(id: UUID, count: number): Promise<void> {
  try {
    const queryText = 'UPDATE errors SET count = $1 WHERE id = $2;';
    await pool.query<ErrorRecord>(queryText, [count, id]);
  } catch (err) {
    console.error('Error executing selectById:', err);
    throw err; // Rethrow the error for further handling, if necessary
  }
}