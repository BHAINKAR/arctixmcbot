const {
  Client,
  GatewayIntentBits,
  ActivityType,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require("discord.js")
const express = require("express")
require("dotenv").config()

// Initialize Express app for Render
const app = express()
const PORT = process.env.PORT || 3000

// Simple route to keep the app alive
app.get("/", (req, res) => {
  res.send("Discord Status Bot is running!")
})

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

// Initialize Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
})

// Configuration
const TOKEN = process.env.DISCORD_TOKEN
const CLIENT_ID = process.env.CLIENT_ID

// Register slash commands
const commands = [
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Change the bot's status")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("The type of status")
        .setRequired(true)
        .addChoices(
          { name: "Playing", value: "PLAYING" },
          { name: "Streaming", value: "STREAMING" },
          { name: "Listening", value: "LISTENING" },
          { name: "Watching", value: "WATCHING" },
          { name: "Competing", value: "COMPETING" },
          { name: "Custom", value: "CUSTOM" },
          { name: "Clear", value: "CLEAR" },
        ),
    )
    .addStringOption((option) => option.setName("text").setDescription("The status text").setRequired(false))
    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("URL for streaming status (only used with Streaming type)")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Restrict to administrators

  new SlashCommandBuilder()
    .setName("aboutme")
    .setDescription("Change the bot's about me")
    .addStringOption((option) => option.setName("text").setDescription("The about me text").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Restrict to administrators

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show available commands")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Restrict to administrators
]

const rest = new REST({ version: "10" }).setToken(TOKEN)

async function registerCommands() {
  try {
    console.log("Started refreshing application (/) commands.")

    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands })

    console.log("Successfully reloaded application (/) commands.")
  } catch (error) {
    console.error(error)
  }
}

// Activity type mapping
const activityTypes = {
  PLAYING: ActivityType.Playing,
  STREAMING: ActivityType.Streaming,
  LISTENING: ActivityType.Listening,
  WATCHING: ActivityType.Watching,
  COMPETING: ActivityType.Competing,
  CUSTOM: ActivityType.Custom,
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`)
  registerCommands()
})

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return

  // Permission check is now handled by Discord through the setDefaultMemberPermissions setting
  // We don't need to manually check for admin permissions anymore

  const { commandName } = interaction

  if (commandName === "status") {
    const statusType = interaction.options.getString("type")
    const statusText = interaction.options.getString("text")
    const streamUrl = interaction.options.getString("url")

    try {
      if (statusType === "CLEAR") {
        // Clear status
        await client.user.setActivity(null)
        await interaction.reply({ content: "Status cleared successfully!", ephemeral: true })
      } else {
        if (!statusText && statusType !== "CUSTOM") {
          return interaction.reply({
            content: "Status text is required for this activity type!",
            ephemeral: true,
          })
        }

        if (statusType === "STREAMING" && !streamUrl) {
          return interaction.reply({
            content: "URL is required for streaming status!",
            ephemeral: true,
          })
        }

        const activityOptions = {
          type: activityTypes[statusType],
          name: statusText || "Custom Status",
        }

        if (statusType === "STREAMING") {
          activityOptions.url = streamUrl
        }

        await client.user.setActivity(activityOptions)
        await interaction.reply({
          content: `Status updated to ${statusType}: ${statusText || "Custom Status"}`,
          ephemeral: true,
        })
      }
    } catch (error) {
      console.error("Error setting status:", error)
      await interaction.reply({
        content: "There was an error setting the status!",
        ephemeral: true,
      })
    }
  } else if (commandName === "aboutme") {
    const aboutText = interaction.options.getString("text")

    try {
      // Set the "About Me" section
      await client.user.setPresence({
        activities: client.user.presence.activities,
        status: client.user.presence.status,
      })

      // Note: Discord.js doesn't directly support changing the "About Me" section
      // This would require using the Discord HTTP API directly

      await interaction.reply({
        content: `About Me would be updated to: "${aboutText}"\n\nNote: Due to Discord API limitations, changing the About Me section requires using the HTTP API directly, which may require additional permissions.`,
        ephemeral: true,
      })
    } catch (error) {
      console.error("Error setting about me:", error)
      await interaction.reply({
        content: "There was an error setting the About Me section!",
        ephemeral: true,
      })
    }
  } else if (commandName === "help") {
    const helpEmbed = {
      title: "Discord Status Bot Commands",
      description: "All commands are restricted to channel administrators",
      fields: [
        {
          name: "/status",
          value:
            "Change the bot's status\nOptions:\n- type: Playing, Streaming, Listening, Watching, Competing, Custom, or Clear\n- text: The status text\n- url: URL for streaming status (only used with Streaming type)",
        },
        {
          name: "/aboutme",
          value: "Change the bot's about me\nOptions:\n- text: The about me text",
        },
        {
          name: "/help",
          value: "Show this help message",
        },
      ],
      color: 0x0099ff,
    }

    await interaction.reply({ embeds: [helpEmbed], ephemeral: true })
  }
})

// Handle errors
client.on("error", (error) => {
  console.error("Discord client error:", error)
})

// Login to Discord
client.login(TOKEN)

// Keep the process alive
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection:", error)
})
