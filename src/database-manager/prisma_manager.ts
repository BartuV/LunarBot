import { PrismaClient } from '@prisma/client'
import logger from '../utils/logger'
import { createClient } from 'redis'

const prisma = new PrismaClient()
const redisClient = createClient({ url: "redis://127.0.0.1:6379" })
await redisClient.connect()

export async function getDiscordIDFromDB(uid: string): Promise<string | null> {
    // Check if the Discord ID is already in the cache
    const cachedDiscordID = await redisClient.get(`discordID:${uid}`)
    if (cachedDiscordID) {
        return cachedDiscordID
    }

    try {
        const discordID = await prisma.discordID.findUnique({
            where: {
                uid: parseInt(uid),
            },
        })
        if (discordID) {
            // Cache the Discord ID for future use
            redisClient.setEx(`discordID:${uid}`, 3600, discordID.discordID)
            return discordID.discordID
        }
        return null
    } catch (error) {
        logger.error('Error getting Discord ID from Prisma:', error)
        return null
    }
}

export async function setDiscordIDInDB(uid: string, discordID: string): Promise<void> {
    try {
        // Update the Discord ID in the database
        await prisma.discordID.upsert({
            where: {
                uid: parseInt(uid),
            },
            update: {
                discordID: discordID,
            },
            create: {
                uid: parseInt(uid),
                discordID: discordID,
            },
        })

        // Update the cache
        redisClient.setEx(`discordID:${uid}`, 86400, discordID)
    } catch (error) {
        logger.error('Error setting Discord ID in Prisma:', error)
    }
}

export async function addAuthUser(ip: string, key: string) {
    try {
        // Check if the auth key is already in the cache
        const cachedKey = await redisClient.get(`authKey:${ip}`)
        if (cachedKey) {
            // If the key is already in the cache, update it
            redisClient.setEx(`authKey:${ip}`, 3600, key)
        } else {
            // If the key is not in the cache, add it
            redisClient.setEx(`authKey:${ip}`, 3600, key)
        }
    } catch (error) {
        logger.error('Error adding Auth User in Redis:', error)
    }
}

export async function getAuthUser(ip: string) {
    try {
        // Check if the auth key is in the cache
        const authKey = await redisClient.get(`authKey:${ip}`)
        if (authKey) {
            return authKey
        }
        return null
    } catch (error) {
        logger.error('Error getting Auth User in Redis:', error)
    }
}

export async function removeAuthUser(ip: string) {
    try {
        // Remove the auth key from the cache
        redisClient.del(`authKey:${ip}`)
    } catch (error) {
        logger.error('Error removing Auth User in Redis:', error)
    }
}

export async function createServerOnDB(server_id: string, server_token: string) {
    // create this function
    try {
        await prisma.server.create({
            data: {
                id: server_id,
                token: server_token,
            }
        })

        redisClient.setEx(`servers:${server_id}`, 3600, server_token)
    } catch (error) {
        logger.error('Error creating Server in Prisma:', error)
    }
}

// function for getting server token with server_id
export async function getServerTokenFromDB(server_id: string) {
    try {
        // Check if the server token is in the cache
        const serverToken = await redisClient.get(`servers:${server_id}`)
        if (serverToken) return serverToken

        // check if the server token is in the database
        const server = await prisma.server.findUnique({
            where: {
                id: server_id
            }
        })
        if (server) {
            // set the server token in the cache
            redisClient.setEx(`servers:${server_id}`, 3600, server.token)
            return server.token
        }
        return null
    } catch (error) {
        logger.error('Error getting Server Token in Redis:', error)
    }
}

// make a function for updating a server token
export async function updateServerTokenInDB(server_id: string, server_token: string) {
    try {
        await prisma.server.update({
            where: {
                id: server_id
            },
            data: {
                token: server_token
            }
        })
        redisClient.setEx(`servers:${server_id}`, 3600, server_token)
    } catch (error) {
        logger.error('Error updating Server Token in Prisma:', error)
    }
}

// create a function for removing a server
export async function removeServerFromDB(server_id: string) {
    try {
        // remove the server from the database
        await prisma.server.delete({
            where: {
                id: server_id
            }
        })
        // remove the server from the cache
        redisClient.del(`servers:${server_id}`)
        redisClient.del(`servers_bloxlink:${server_id}`)
    } catch (error) {
        logger.error('Error removing Server in Prisma:', error)
    }
}

export async function addChannelToServer(channel_id: string, channel_name: string, server_id: string) {
    // add new channel to server with the serverid
    try {
        const channel = await prisma.channel.create({
            data: {
                id: channel_id,
                name: channel_name,
                // serverId: server_id,
                server: {
                    connect: {
                        id: server_id
                    }
                }
            }
        })
        return true
    } catch (error) {
        logger.error('Error adding Channel to Server in Prisma:', error)
        return false
    }
}

export async function getChannelsFromServer(server_id: string) {
    // return all the channels in th server with server id
    try {
        const channels = await prisma.channel.findMany({
            where: {
                serverId: server_id
            }
        })
        if (channels) return channels
    } catch (error) {
        logger.error('Error getting Channels from Server in Prisma:', error)
    }
}

// generate a function for removing a channel with channelid
export async function removeChannelFromServer(channel_id: string) {
    try {
        const channel = await prisma.channel.delete({
            where: {
                id: channel_id
            }
        })
        return true
    } catch (error) {
        logger.error('Error removing Channel from Server in Prisma:', error)
        return false
    }
}