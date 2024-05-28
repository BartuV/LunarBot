import { v4 } from "uuid"
import { equals } from "validator"
import { sign, verify } from "jsonwebtoken"
import { Elysia } from 'elysia'
import logger from "../utils/logger"
import { setDiscordIDInDB, getDiscordIDFromDB, getAuthUser, addAuthUser, removeAuthUser, getServerTokenFromDB, getChannelsFromServer } from "../database-manager/prisma_manager"
import { client, getRole, moveUserToVoiceChannel } from "../discord-bot/bot"
import { ip } from "elysia-ip"
import { createHash } from "crypto"

const app = new Elysia()
    .use(ip())
    .get("/to/:uid/:cid/:gid", async ({ params: { uid, cid, gid }, headers, ip }) => {
        if (!client.isReady()) return new Response("Bot isn't active yet")
        if (!headers["jwttoken"]) return new Response("jwttoken wasnt provided in headers")
        if (!headers["bloxlink-token"]) return new Response("Please provide a bloxlink token in the headers")

        const server_token = await getServerTokenFromDB(gid)
        if (!server_token) return new Response("Please register your server with the discord bot")

        return verify(headers["jwttoken"], server_token, async (err: any, decoded: any) => {
            if (err) { if (err.name === "TokenExpiredError") { removeAuthUser(ip.toString()); return } }
            const authUser = await getAuthUser(ip)
            if (!authUser) return

            const stored_JWT: any = verify(authUser, server_token)
            if (!stored_JWT.uid) return errorResponse("You are not logged in")
            if (!(stored_JWT.uid === decoded.uid)) return errorResponse("Wrong id")

            if (!headers["bloxlink-token"]) return 

            try {
                let data = await getDiscordIDFromDB(uid)
                if (data) {
                    moveUserToVoiceChannel(data, cid, gid)
                } else {
                    const id = await getUser(uid, gid, headers["bloxlink-token"])
                    if (!id) return errorResponse("User not found")
                    setDiscordIDInDB(uid, id)
                    moveUserToVoiceChannel(id, cid, gid)
                }
            } catch (error) {
                logger.error("Error getting Discord ID from SQLite3:", error);
            }
        })
    })
    .get("/getChannels/:gid", async ({ params: { gid }, headers, ip }) => {
        if (!client.isReady()) return new Response("Bot isn't active yet")
        if (!headers["jwttoken"]) return new Response("jwttoken wasnt provided in headers")

        const server_token = await getServerTokenFromDB(gid)
        if (!server_token) return new Response("Please register your server with the discord bot")

        return verify(headers["jwttoken"], server_token, async (err: any, decoded: any) => {
            if (err) { return errorResponse(err) }
            
            const authUser = await getAuthUser(ip)
            if (!authUser) return

            const a: any = verify(authUser, server_token)
            if (!a.uid) return errorResponse("You are not logged in")
            if (!(a.uid === decoded.uid)) return errorResponse("Wrong id")

            const channels = await getChannelsFromServer(gid)
            if (!channels) return new Response("Please register with the roblox bot")
            let val = JSON.stringify(channels)
            return new Response(val)
        })
    })
    .get("/auth/:gid", async ({ params: { gid }, headers, ip }) => {
        if (!headers["servertoken"]) { return errorResponse("servertoken wasn't specified in headers") }
        const server_token = await getServerTokenFromDB(gid)
        if (!server_token) return new Response("Please register your server with the discord bot")
        if (!equals(server_token, hashAPIKey(headers["servertoken"]))) { return errorResponse("servertoken doesn't equals to server key") }

        return await newToken(ip.toString(), gid)
    })
    .get("/getRole/:uid/:gid", async ({ params: { uid, gid }, headers, ip }) => {
        if (!client.isReady()) return new Response("Bot isn't active yet")
            if (!headers["jwttoken"]) return new Response("jwttoken wasnt provided in headers")
            if (!headers["bloxlink-token"]) return new Response("Please provide a bloxlink token in the headers")
    
            const server_token = await getServerTokenFromDB(gid)
            if (!server_token) return new Response("Please register your server with the discord bot")
    
            return verify(headers["jwttoken"], server_token, async (err: any, decoded: any) => {
                if (err) { if (err.name === "TokenExpiredError") { removeAuthUser(ip.toString()); return } }
                const authUser = await getAuthUser(ip)
                if (!authUser) return
    
                const stored_JWT: any = verify(authUser, server_token)
                if (!stored_JWT.uid) return errorResponse("You are not logged in")
                if (!(stored_JWT.uid === decoded.uid)) return errorResponse("Wrong id")
    
                if (!headers["bloxlink-token"]) return 
    
                try {
                    let data = await getDiscordIDFromDB(uid)
                    if (!data) {
                        const id = await getUser(uid, gid, headers["bloxlink-token"])
                        if (!id) return errorResponse("User not found")
                        setDiscordIDInDB(uid, id)
                        return await getRole(id,gid)
                    } else {
                        return await getRole(data,gid)
                    }
                } catch (error) {
                    logger.error("Error getting Discord ID from SQLite3:", error);
                }
            })
    })
    .listen(5050)

logger.warn("Web Server Alive!")


function errorResponse(err: string, statusCode?: number) {
    return new Response("Telsiz Error: " + err, { status: statusCode || 500 })
}

function hashAPIKey(apikey:string){
    return createHash("md5").update(apikey).digest("hex")
}

async function newToken(ip: string, gid: string) {
    const server_token = await getServerTokenFromDB(gid)
    if (!server_token) return new Response("Please register your server with the discord bot")

    const new_token = sign({
        uid: v4(),
    }, server_token, { expiresIn: "1h" })

    addAuthUser(ip.toString(), new_token)

    return new_token
}

async function getUser(uid: string, gid: string, bloxlink_token:string): Promise<any> {
    try {
        if (!bloxlink_token) return null
        const json = await fetch(`https://api.blox.link/v4/public/guilds/${gid}/roblox-to-discord/${uid}`, {
            headers: { 'Authorization': bloxlink_token }
        }).then((response) => response.json())

        if (json.discordIDs[0]) {
            if (json.discordIDs.lenght > 1) logger.warn(`User ${uid} has more than 1 discord accounts connected.`)
            return json.discordIDs[0]
        }

        return null
    } catch (error) {
        logger.error('Error getting user data from Bloxlink API:', error)
        return null
    }
}