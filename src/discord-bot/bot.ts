import { Client, GatewayIntentBits, Collection, VoiceChannel, User, ChannelType, Events, REST, Routes } from "discord.js"
import { readdir } from "node:fs/promises"
import logger from "../utils/logger"

const { token, application_id } = require('../config.json')

// Create a new client instance
export const client = new Client({ intents: [GatewayIntentBits.Guilds] })

let client_commands = new Collection<string, any>()

export async function getGuildMember(discordId: string, guildId: string) {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) { logger.error("getGuildMember Error: guildId is invalid"); return null }

    const user = await client.users.fetch(discordId)
    if (!user) { logger.error("getGuildMember Error: user cant be found"); return null }

    const member = await guild.members.fetch({ user: user, force: true });
    if (!member) { logger.error("getGuildMember Error: cannot get member"); return null }

    return member; // GuildMember object
}

export async function getRole(discordId: string, guildId: string) {
    const member = await getGuildMember(discordId, guildId)
    if (!member) return
    return JSON.stringify(member.roles.valueOf().map((val, key) => {
        return { key: key, name: val.name, color: val.hexColor }
    }))
}

export async function moveUserToVoiceChannel(discordId: string, voiceChannelId: string, gid: string) {
    let member = await getGuildMember(discordId, gid);
    if (!member) return;
    try {
        let channel = await client.channels.fetch(voiceChannelId).then((channel) => { if (channel?.type === ChannelType.GuildVoice) return channel })
        if (!channel) return
        await member.voice.setChannel(channel)
    } catch (e) {
        logger.warn("moveUserToVoiceChannel Error: " + e)
        return e
    }
}

client.once(Events.ClientReady, async readyClient => {
    logger.info(`Ready! Logged in as ${readyClient.user.tag}`)

    const files = await readdir(import.meta.dir + "/commands");
    const commandsPromises = files.map(async (val, idx) => {
        const mod = await import(import.meta.dir + "/commands/" + val);
        client_commands.set(mod.data.name, mod.execute)
        return await mod.data.toJSON();
    });

    const commands = await Promise.all(commandsPromises);
    const rest = new REST({ version: '9' }).setToken(token);

    (async () => {
        try {
            await rest.put(
                Routes.applicationCommands(application_id),
                { body: commands },
            );

            logger.info('Successfully registered application commands.');
        } catch (error) {
            logger.error(error);
        }
    })()
})

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    const command = client_commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command(interaction);
    } catch (error) {
        if (error) console.error(error);
        logger.error({ content: 'There was an error while executing this command!', ephemeral: true });
    }
})

// Log in to Discord with your client's token
client.login(token)