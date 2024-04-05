import pg, { DatabaseError } from 'pg';
import { UserStat, message } from '../types/sometypes.js';
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


// export async function insertIntoPostgres(uuid: string, message: any, groupid: number | null, firstmessageid: number, chatid: number) {
  
  
//   const query = (groupid) ? `
//     INSERT INTO message(uuid, message, groupid, firstmessageid, chatid)
//     VALUES($1, $2, $3, $4, $5)
//   ` 
//   : `INSERT INTO message(uuid, message, firstmessageid, chatid)
//     VALUES($1, $2, $3, $4)
//   `
  
//   try {
//     if (groupid) {
//       console.log(groupid)
//       console.log('пытаюсь c группой')
//       await pool.query(query, [uuid, message, groupid, firstmessageid, chatid]);
//     } else {
//       console.log(groupid)
//       console.log('пытаюсь без группы')
//       await pool.query(query, [uuid, message, firstmessageid, chatid]);
//     }
//     // console.log('Insertion successful, new row id:', res.rows[0].id);
//     // return res.rows[0].id; // Return the new row's ID
//   } catch (err) {
//     console.error('Error inserting into PostgreSQL:', err);
//     return null; // It's helpful to explicitly return null or some error indicator in case of failure
//   }
// }


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



export async function insertUserStatistic(chatid: number, userid: bigint, value: number) {
  const bayan = JSON.stringify({ userid: userid, value: value });

  const query = `
    INSERT INTO user_statistics (chatid, bayan)
    VALUES ($1, $2)
    RETURNING *;
  `;

  try {
    const res = await pool.query(query, [chatid, bayan]);
    console.log(res.rows[0]); // Output the inserted row
  } catch (err) {
    console.error('Error inserting into user_statistics:', err);
  }
}



export async function fetchDataByChatId(chatid: number): Promise<UserStat | null | {}> {
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