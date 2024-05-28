import { Database } from "bun:sqlite"
import logger from "../utils/logger"
import { mkdir } from "node:fs/promises"

try {
    await mkdir("/databases")
    logger.warn("Created databases folder")
} catch (e) {
    logger.error(e)
}

const discordIdDB = new Database(import.meta.dir + "/databases/data.db")
const JWTtokenDB = new Database(import.meta.dir + "/databases/auth.db")
const ServerTokenDB = new Database(import.meta.dir + "/databases/server-tokens.db")

// Create tables if they don't exist
discordIdDB.exec(`CREATE TABLE IF NOT EXISTS discordIDs (uid INTEGER UNIQUE PRIMARY KEY, discordID TEXT UNIQUE)`)
discordIdDB.exec("PRAGMA journal_mode = WAL;");

JWTtokenDB.exec(`CREATE TABLE IF NOT EXISTS auth_keys (ip TEXT UNIQUE PRIMARY KEY, key TEXT UNIQUE)`)
JWTtokenDB.exec("PRAGMA journal_mode = WAL;");

ServerTokenDB.exec("CREATE TABLE IF NOT EXISTS keys (gid TEXT UNIQUE PRIMARY KEY, token TEXT UNIQUE)")

export async function getDiscordIDFromDB(uid: string): Promise<string | null> {
    try {
        const query = discordIdDB.prepare(`SELECT discordID FROM discordIDs WHERE uid = ?`)
        const result: any = query.get(uid)
        if (result) { return result.discordID }
        return null
    } catch (error) {
        logger.error('Error getting Discord ID from SQLite3:', error)
        return null
    }
}

export async function setDiscordIDInDB(uid: string, discordID: string): Promise<void> {
    try {
        const query = discordIdDB.prepare(`INSERT INTO discordIDs (uid, discordID) VALUES (?,?)`)
        query.run(uid, discordID)
    } catch (error) {
        logger.error('Error setting Discord ID in SQLite3:', error)
    }
}

export async function addAuthUser(ip: string, key: string) {
    try {
        const existingRecord: any = JWTtokenDB.query(`SELECT key FROM auth_keys WHERE ip = ?`).get(ip);

        if (existingRecord.key) {
            // Kayıt zaten mevcut. Güncelle.
            JWTtokenDB.run(`UPDATE auth_keys SET key = ? WHERE ip = ?`, [key, ip]);
        } else {
            // Kayıt bulunamadı. Yeni bir kayıt ekle.
            JWTtokenDB.run(`INSERT INTO auth_keys (ip, key) VALUES (?,?)`, [ip, key]);
        }
    } catch (error) {
        logger.error('Error Adding Auth User in SQLite3:', error)
    }
}

export async function getAuthUser(ip: string) {
    try {
        const query = JWTtokenDB.prepare(`SELECT key FROM auth_keys WHERE ip = ?`)
        const result: any = query.get(ip)
        if (result) { return result.key }
        return null
    } catch (error) {
        logger.error('Error getting Auth User in SQLite3:', error)
    }
}

export async function removeAuthUser(ip: string) {
    // remove the ip from the authdb
    try {
        const query = discordIdDB.prepare(`DELETE FROM auth_keys WHERE ip = ?`)
        query.run(ip)
    } catch (error) {
        logger.error('Error removing Auth User in SQLite3:', error)
    }
}

export async function getServerTokenFromDB(gid: string) {
    try {
        const query: any = ServerTokenDB.prepare(`SELECT token FROM keys WHERE gid = ?`).get(gid)
        return query.token
    } catch (e) {
        logger.error("Error getting server-token from database: " + e)
    }
}

export async function setServerTokenToDB(gid:string,token:string) {
    try {
        ServerTokenDB.prepare(`INSERT INTO keys (gid,token) VALUES (?,?)`).run(gid,token);
    } catch (e) {
        logger.error("Error setting server-token to database: " + e)
    }
}