import pg from 'pg';
import { message } from '../types/sometypes.js';
const { Pool } = pg;


const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'tgclient',
    password: '51kln00bfd54FTY',
    port: 5432,
});


export async function insertIntoPostgres(uuid: string, message: any, groupid: number, firstmessageid: number) {
  const query = `
    INSERT INTO message(uuid, message, groupid, firstmessageid)
    VALUES($1, $2, $3, $4)
  `;
  
  try {
    await pool.query(query, [uuid, message, groupid, firstmessageid]);
    // console.log('Insertion successful, new row id:', res.rows[0].id);
    // return res.rows[0].id; // Return the new row's ID
  } catch (err) {
    console.error('Error inserting into PostgreSQL:', err);
    return null; // It's helpful to explicitly return null or some error indicator in case of failure
  }
}


export async function findByUuid(uuid: string): Promise<message|null> {
    const query = `
      SELECT * FROM message
      WHERE uuid = $1;
    `;
  
    try {
      const res = await pool.query(query, [uuid]);
      return res.rows[0]
    } catch (err) {
      console.error('Error querying PostgreSQL:', err);
      return null;
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