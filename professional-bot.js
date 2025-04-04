// professional-bot.js - Discord Bot Status Manager
// A complete solution to maintain Discord bot status persistently

const { Client, GatewayIntentBits, ActivityType, REST, Routes, SlashCommandBuilder } = require("discord.js")
const fs = require("fs")
const path = require("path")
const readline = require("readline")
const http = require("http")
require("dotenv").config()

// Configuration
const CONFIG = {
  // Status check interval in milliseconds (1 minute)
  statusCheckInterval: 60000,

  // Default status if none is set
  defaultStatus: {
    type: ActivityType.Playing,
    text: "Discord",
  },

  // Botghost removal settings
  botghost: {
    // Set to true to completely disable botghost integration
    disable: true,

    // Commands to override botghost status commands
    commandPrefix: "!",
  },

  // Web server settings for Render.com
  server: {
    // Default port (will be overridden by environment variable if available)
    port: process.env.PORT || 8080,
  },
}

// ============================
// Status Storage Implementation
// ============================
class StatusStorage {
  constructor() {
    this.filePath = path.join(process.cwd(), "data", "status.json")
  }

  async ensureDirectoryExists() {
    const directory = path.dirname(this.filePath)

    try {
      await fs.promises.access(directory)
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.promises.mkdir(directory, { recursive: true })
    }
  }

  async saveStatus(status) {
    try {
      await this.ensureDirectoryExists()
      await fs.promises.writeFile(this.filePath, JSON.stringify(status, null, 2))
    } catch (error) {
      console.error("Failed to save status:", error)
    }
  }

  async getStatus() {
    try {
      await this.ensureDirectoryExists()

      try {
        await fs.promises.access(this.filePath)
      } catch (error) {
        // File doesn't exist yet
        return null
      }

      const data = await fs.promises.readFile(this.filePath, "utf-8")
      return JSON.parse(data)
    } catch (error) {
      console.error("Failed to load status:", error)
      return null
    }
  }
}

// ============================
// Status Manager Implementation
// ============================
class StatusManager {
  constructor(client, storage) {
    this.client = client
    this.storage = storage
    this.monitorInterval = null
    this.currentStatus = null
  }

  async initialize() {
    // Load the saved status from storage
    const savedStatus = await this.storage.getStatus()

    if (savedStatus) {
      this.currentStatus = savedStatus
      await this.applyStatus(savedStatus)
    } else {
      // Set a default status if none is saved
      const defaultStatus = CONFIG.defaultStatus

      this.currentStatus = defaultStatus
      await this.applyStatus(defaultStatus)
      await this.storage.saveStatus(defaultStatus)
    }
  }

  async setStatus(status) {
    this.currentStatus = status
    await this.applyStatus(status)
    await this.storage.saveStatus(status)
  }

  async applyStatus(status) {
    if (!this.client.user) return

    try {
      await this.client.user.setActivity(status.text, { type: status.type })
      console.log(`Status updated to: ${ActivityType[status.type]} ${status.text}`)
    } catch (error) {
      console.error("Failed to update status:", error)
    }
  }

  startMonitoring() {
    // Check every minute if the status has changed and reapply if necessary
    this.monitorInterval = setInterval(async () => {
      if (!this.client.user || !this.currentStatus) return

      const currentActivity = this.client.user.presence.activities[0]

      // If no activity or activity doesn't match our stored status, reapply
      if (
        !currentActivity ||
        currentActivity.type !== this.currentStatus.type ||
        currentActivity.name !== this.currentStatus.text
      ) {
        console.log("Status mismatch detected, reapplying status...")
        await this.applyStatus(this.currentStatus)
      }
    }, CONFIG.statusCheckInterval)
  }

  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
    }
  }

  getCurrentStatus() {
    return this.currentStatus
  }
}

// ============================
// Command Handler Implementation
// ============================
class CommandHandler {
  constructor(client, statusManager) {
    this.client = client
    this.statusManager = statusManager

    // Define commands
    this.commands = [
      new SlashCommandBuilder()
        .setName("setstatus")
        .setDescription("Set the bot's status")
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
            ),
        )
        .addStringOption((option) => option.setName("text").setDescription("The status text").setRequired(true)),

      new SlashCommandBuilder().setName("getstatus").setDescription("Get the current bot status"),

      new SlashCommandBuilder().setName("resetstatus").setDescription("Reset the bot status to default"),
    ]

    // Set up interaction handler
    this.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand()) return

      await this.handleCommand(interaction)
    })
  }

  async registerCommands() {
    if (!this.client.user) return

    try {
      console.log("Started refreshing application (/) commands.")

      const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN || "")

      await rest.put(Routes.applicationCommands(this.client.user.id), { body: this.commands })

      console.log("Successfully reloaded application (/) commands.")
    } catch (error) {
      console.error("Failed to register commands:", error)
    }
  }

  async handleCommand(interaction) {
    const { commandName } = interaction

    try {
      if (commandName === "setstatus") {
        const typeStr = interaction.options.getString("type", true)
        const text = interaction.options.getString("text", true)

        // Convert string to ActivityType
        const type = ActivityType[typeStr]

        await this.statusManager.setStatus({ type, text })
        await interaction.reply({ content: `Status set to: ${typeStr} ${text}`, ephemeral: true })
      } else if (commandName === "getstatus") {
        const currentStatus = this.statusManager.getCurrentStatus()

        if (currentStatus) {
          const typeStr = ActivityType[currentStatus.type]
          await interaction.reply({
            content: `Current status: ${typeStr} ${currentStatus.text}`,
            ephemeral: true,
          })
        } else {
          await interaction.reply({
            content: "No status is currently set.",
            ephemeral: true,
          })
        }
      } else if (commandName === "resetstatus") {
        const defaultStatus = CONFIG.defaultStatus

        await this.statusManager.setStatus(defaultStatus)
        await interaction.reply({
          content: "Status has been reset to default.",
          ephemeral: true,
        })
      }
    } catch (error) {
      console.error(`Error handling command ${commandName}:`, error)
      await interaction.reply({
        content: "An error occurred while processing your command.",
        ephemeral: true,
      })
    }
  }
}

// ============================
// Botghost Handler Implementation
// ============================
class BotghostHandler {
  constructor(client, statusManager) {
    this.client = client
    this.statusManager = statusManager

    // Listen for message events to intercept botghost commands
    this.client.on("messageCreate", this.handleMessage.bind(this))
  }

  async handleMessage(message) {
    // Ignore messages from bots
    if (message.author.bot) return

    // Check if this is a botghost command
    if (this.isBotghostCommand(message.content)) {
      // If it's a status-related command, intercept it
      if (this.isStatusCommand(message.content)) {
        await this.handleStatusCommand(message)
        return
      }

      // For other botghost commands, let them pass through
      // but ensure our status remains intact
      setTimeout(async () => {
        const currentStatus = this.statusManager.getCurrentStatus()
        if (currentStatus) {
          await this.statusManager.applyStatus(currentStatus)
        }
      }, 1000) // Wait a second to let the botghost command execute
    }
  }

  isBotghostCommand(content) {
    // Check if the message starts with common botghost command prefixes
    const prefixes = ["!", "/", ".", "$"]
    return prefixes.some((prefix) => content.startsWith(prefix))
  }

  isStatusCommand(content) {
    // Check if the command is related to status
    const statusKeywords = ["status", "presence", "activity", "playing", "watching", "listening"]
    return statusKeywords.some((keyword) => content.toLowerCase().includes(keyword))
  }

  async handleStatusCommand(message) {
    // Acknowledge the command but maintain our status
    await message.reply(
      "Status commands are now handled by the built-in status manager. Please use /setstatus instead.",
    )

    // Ensure our status remains intact
    setTimeout(async () => {
      const currentStatus = this.statusManager.getCurrentStatus()
      if (currentStatus) {
        await this.statusManager.applyStatus(currentStatus)
      }
    }, 1000)
  }
}

// ============================
// Web Server for Render.com
// ============================
class WebServer {
  constructor(statusManager) {
    this.statusManager = statusManager
    this.server = null
  }

  start() {
    const port = CONFIG.server.port

    this.server = http.createServer((req, res) => {
      // Handle health check endpoint
      if (req.url === "/health") {
        const currentStatus = this.statusManager ? this.statusManager.getCurrentStatus() : null
        const statusText = currentStatus ? `${ActivityType[currentStatus.type]} ${currentStatus.text}` : "No status set"

        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(
          JSON.stringify({
            status: "ok",
            message: "Discord Bot Status Manager is running",
            botStatus: statusText,
            uptime: process.uptime(),
          }),
        )
        return
      }

      // Handle root endpoint
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Discord Bot Status Manager</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                line-height: 1.6;
              }
              h1 {
                color: #5865F2;
              }
              .status {
                background-color: #f4f4f4;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
              }
            </style>
          </head>
          <body>
            <h1>Discord Bot Status Manager</h1>
            <p>Your Discord bot is running successfully!</p>
            <div class="status">
              <h2>Bot Status</h2>
              <p>Current status: ${
                this.statusManager
                  ? this.statusManager.getCurrentStatus()
                    ? `${ActivityType[this.statusManager.getCurrentStatus().type]} ${this.statusManager.getCurrentStatus().text}`
                    : "No status set"
                  : "Status manager not initialized"
              }</p>
              <p>Uptime: ${Math.floor(process.uptime() / 60)} minutes</p>
            </div>
            <p>This web server keeps your bot running on Render.com</p>
          </body>
        </html>
      `)
    })

    this.server.listen(port, () => {
      console.log(`Web server running on port ${port}`)
      console.log(`Health check available at: http://localhost:${port}/health`)
    })

    this.server.on("error", (error) => {
      console.error("Web server error:", error)
    })
  }

  stop() {
    if (this.server) {
      this.server.close()
      this.server = null
    }
  }
}

// ============================
// Token Setup Helper
// ============================
async function promptForToken() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    console.log("Discord Bot Status Manager Setup")
    console.log("================================\n")

    // Create data directory if it doesn't exist
    if (!fs.existsSync("./data")) {
      fs.mkdirSync("./data", { recursive: true })
      console.log("✅ Created data directory")
    }

    console.log("\nPlease enter your Discord bot token:")
    console.log("(You can find this in the Discord Developer Portal: https://discord.com/developers/applications)")

    rl.question("> ", (token) => {
      if (!token || token.trim() === "") {
        console.log("❌ Token cannot be empty. Please try again.")
        rl.close()
        promptForToken().then(resolve)
        return
      }

      // Create .env file with the token
      const envContent = `DISCORD_TOKEN=${token.trim()}`

      fs.writeFileSync("./.env", envContent)
      console.log("✅ Created .env file with your Discord token")

      rl.close()
      resolve()
    })
  })
}

// ============================
// Main Function
// ============================
async function main() {
  // Check if .env file exists, if not prompt for token
  if (!process.env.DISCORD_TOKEN) {
    if (fs.existsSync("./.env")) {
      require("dotenv").config()
    } else {
      await promptForToken()
      require("dotenv").config()
    }
  }

  // Create a new client instance
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
  })

  // Initialize status storage
  const statusStorage = new StatusStorage()

  // Initialize status manager
  const statusManager = new StatusManager(client, statusStorage)

  // Initialize command handler
  const commandHandler = new CommandHandler(client, statusManager)

  // Initialize botghost handler
  const botghostHandler = new BotghostHandler(client, statusManager)

  // Initialize web server for Render.com
  const webServer = new WebServer(statusManager)
  webServer.start()

  // When the client is ready, run this code (only once)
  client.once("ready", async () => {
    console.log(`Logged in as ${client.user.tag}!`)

    // Initialize the status manager
    await statusManager.initialize()

    // Start the status monitoring
    statusManager.startMonitoring()

    // Register commands
    await commandHandler.registerCommands()

    console.log("Bot is ready!")
  })

  // Login to Discord with your client's token
  client.login(process.env.DISCORD_TOKEN)

  // Add event listeners for graceful shutdown
  process.on("SIGINT", () => {
    console.log("Received SIGINT. Bot is shutting down...")
    webServer.stop()
    process.exit(0)
  })

  process.on("SIGTERM", () => {
    console.log("Received SIGTERM. Bot is shutting down...")
    webServer.stop()
    process.exit(0)
  })
}

// Start the bot
console.log("Starting Discord Bot Status Manager...")
main().catch((error) => {
  console.error("Failed to start the bot:", error)
})
