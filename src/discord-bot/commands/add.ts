import { ChannelType, CommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, VoiceChannel } from "discord.js"
import { addChannelToServer, createServerOnDB, getServerTokenFromDB, removeChannelFromServer, updateServerTokenInDB } from "../../database-manager/prisma_manager"
import { createHash, randomBytes } from "crypto"

export const data = new SlashCommandBuilder()
    .setName('setup')
    .setDescription("For radio setups")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(command => command
        .setName('channel')
        .setDescription("Editing channels for roblox")
        .addChannelOption(option => option
            .setName('channel')
            .setDescription('Channel to add')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addStringOption(option => option
            .setName('method')
            .setDescription("Add or Remove channel")
            .addChoices(
                { name: "Add", value: "add" },
                { name: "Remove", value: "remove" }
            )
            .setRequired(true)
        )
    )
    .addSubcommand(group => group
        .setName('token')
        .setDescription("Token utils for roblox")
        .addStringOption(option => option
            .setName('method')
            .setDescription("Add or Remove channel")
            .addChoices(
                { name: "Create", value: "create" },
                { name: "Reset", value: "reset" }
            )
            .setRequired(true)
        )
    )

async function handleChannel(parsed_options: any[], interaction: CommandInteraction) {
    if (!interaction.guildId) return

    const channel: VoiceChannel = parsed_options[0]
    const method: string = parsed_options[1]

    switch (method) {
        case "add":
            const add_success = await addChannelToServer(channel.id, channel.name, interaction.guildId)
            if (add_success) {
                interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("Channel added successfully")
                            .addFields({ name: "Added Channel: ", value: channel.name })
                            .setColor(0x000000)
                    ], ephemeral: true
                })
            } else {
                interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("Please first setup your server.")
                            .setDescription("You can do it by running /setup token get.")
                    ], ephemeral: true
                })
            }
            break

        case "remove":
            const remove_success = await removeChannelFromServer(channel.id)
            if (remove_success) {
                interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("Channel removed successfully")
                            .addFields({ name: "Removed Channel: ", value: channel.name })
                            .setColor(0x000000)
                    ], ephemeral: true
                })
            } else {
                interaction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle("Please first setup your server.")
                            .setDescription("You can do it by running /setup token get.")
                    ], ephemeral: true
                })
            }
            break
    }
}

async function handleToken(parsed_options: any[], interaction: CommandInteraction) {
    if (!interaction.guildId) return
    const token = await getServerTokenFromDB(interaction.guildId)
    const channel = await getDMChannel(interaction)

    switch (parsed_options[0]) {
        case "reset":
            if (!token) { channel.send("You need to create an token before resetting it"); return }
            const apiKey = randomBytes(16).toString("hex")
            const hashed_api_key = hashAPIKey(apiKey)
            await updateServerTokenInDB(interaction.guildId, hashed_api_key)
            channel.send(`Successfully reseted ${interaction.guild?.name} token. Your token is: ${apiKey}. Note this down because you cant see this again.`)
            break
        case "create":
            if (!token) {
                const apiKey = randomBytes(16).toString("hex")
                const hashed_api_key = hashAPIKey(apiKey)
                await createServerOnDB(interaction.guildId, hashed_api_key)
                channel.send(`Successfully created ${interaction.guild?.name} to db. Your token is: ${apiKey}. Note this down because you cant see this again.`)
            } else {
                channel.send("You alredy have an token. if you want to see it again reset it")
            }
            break
    }
    interaction.reply({ content: "ok", ephemeral: true })
}

async function getDMChannel(interaction: CommandInteraction) {
    return interaction.user.dmChannel ? interaction.user.dmChannel : await interaction.user.createDM(true)
}

function hashAPIKey(apikey: string) {
    return createHash("md5").update(apikey).digest("hex")
}

export async function execute(interaction: CommandInteraction) {
    if (!interaction.guildId) return

    const options = interaction.options.data[0]
    if (!options.options) return

    switch (options.name) {
        case "channel":
            handleChannel(options.options.map((val) => { return val.channel ? val.channel : val.value }), interaction)
            break

        case "token":
            handleToken(options.options.map((val) => { return val.value }), interaction)
            break
    }
}