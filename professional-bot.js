const express = require("express")
const http = require("http")
const WebSocket = require("ws")
const { Client, GatewayIntentBits } = require("discord.js")
const fetch = require("node-fetch")

/**
 * Discord Status Remover Bot
 * A professional bot to manage and remove Discord status
 */
class ProfessionalBot {
  constructor() {
    // Default port configuration
    this.ports = {
      app: 3000,
      api: 3001,
      ws: 3002,
      gateway: 4000,
      debug: 9000,
    }

    // Discord configuration
    this.discord = {
      token: process.env.DISCORD_TOKEN || "",
      clientId: process.env.DISCORD_CLIENT_ID || "",
      apiEndpoint: "https://discord.com/api/v10",
    }

    // Initialize components
    this.initExpress()
    this.initWebSocket()
    this.initDiscordClient()
  }

  /**
   * Initialize Express servers
   */
  initExpress() {
    // Main application server
    this.app = express()
    this.server = http.createServer(this.app)

    // API server
    this.apiApp = express()
    this.apiServer = http.createServer(this.apiApp)

    // Configure routes
    this.configureRoutes()
  }

  /**
   * Configure Express routes
   */
  configureRoutes() {
    // Main app routes
    this.app.use(express.json())

    this.app.get("/", (req, res) => {
      res.send("Discord Status Remover - Professional Bot")
    })

    this.app.get("/status", (req, res) => {
      res.json({
        status: "online",
        servers: {
          main: `Running on port ${this.ports.app}`,
          api: `Running on port ${this.ports.api}`,
          ws: `Running on port ${this.ports.ws}`,
          gateway: `Configured for port ${this.ports.gateway}`,
          debug: `Available on port ${this.ports.debug}`,
        },
      })
    })

    // API routes
    this.apiApp.use(express.json())

    this.apiApp.get("/", (req, res) => {
      res.send("Discord Status Remover API")
    })

    // Route to remove status
    this.apiApp.post("/remove-status", async (req, res) => {
      try {
        const { userId, token } = req.body

        if (!userId || !token) {
          return res.status(400).json({ error: "Missing userId or token" })
        }

        const result = await this.removeUserStatus(userId, token)
        res.json(result)
      } catch (error) {
        console.error("Error removing status:", error)
        res.status(500).json({ error: "Failed to remove status" })
      }
    })

    // Route to set custom status
    this.apiApp.post("/set-status", async (req, res) => {
      try {
        const { userId, token, status } = req.body

        if (!userId || !token) {
          return res.status(400).json({ error: "Missing userId or token" })
        }

        const result = await this.setUserStatus(userId, token, status)
        res.json(result)
      } catch (error) {
        console.error("Error setting status:", error)
        res.status(500).json({ error: "Failed to set status" })
      }
    })
  }

  /**
   * Initialize WebSocket server
   */
  initWebSocket() {
    this.wss = new WebSocket.Server({ port: this.ports.ws })

    this.wss.on("connection", (ws) => {
      console.log("WebSocket client connected")

      ws.on("message", async (message) => {
        try {
          const data = JSON.parse(message)
          console.log("Received message:", data)

          if (data.action === "removeStatus") {
            const result = await this.removeUserStatus(data.userId, data.token)
            ws.send(JSON.stringify(result))
          } else if (data.action === "setStatus") {
            const result = await this.setUserStatus(data.userId, data.token, data.status)
            ws.send(JSON.stringify(result))
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error)
          ws.send(JSON.stringify({ error: "Failed to process request" }))
        }
      })

      // Send initial connection confirmation
      ws.send(JSON.stringify({ connected: true, timestamp: new Date().toISOString() }))
    })
  }

  /**
   * Initialize Discord client
   */
  initDiscordClient() {
    if (!this.discord.token) {
      console.warn("Discord token not provided. Bot functionality will be limited.")
      return
    }

    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMembers],
    })

    this.client.on("ready", () => {
      console.log(`Logged in as ${this.client.user.tag}`)
    })

    this.client.login(this.discord.token).catch((error) => {
      console.error("Failed to login to Discord:", error)
    })
  }

  /**
   * Remove user status via Discord API
   * @param {string} userId - Discord user ID
   * @param {string} token - User's Discord token
   * @returns {Promise<object>} - Result of the operation
   */
  async removeUserStatus(userId, token) {
    try {
      // Discord API endpoint for user settings
      const endpoint = `${this.discord.apiEndpoint}/users/@me/settings`

      // Request to clear custom status
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          custom_status: null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: errorData,
          message: "Failed to remove status",
        }
      }

      return {
        success: true,
        message: "Status removed successfully",
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error("Error in removeUserStatus:", error)
      return {
        success: false,
        error: error.message,
        message: "Internal error removing status",
      }
    }
  }

  /**
   * Set user status via Discord API
   * @param {string} userId - Discord user ID
   * @param {string} token - User's Discord token
   * @param {object} status - Status object with text, emoji_name, etc.
   * @returns {Promise<object>} - Result of the operation
   */
  async setUserStatus(userId, token, status) {
    try {
      // Discord API endpoint for user settings
      const endpoint = `${this.discord.apiEndpoint}/users/@me/settings`

      // Request to set custom status
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          custom_status: status,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: errorData,
          message: "Failed to set status",
        }
      }

      return {
        success: true,
        message: "Status set successfully",
        status: status,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      console.error("Error in setUserStatus:", error)
      return {
        success: false,
        error: error.message,
        message: "Internal error setting status",
      }
    }
  }

  /**
   * Start all servers
   */
  start() {
    // Start main server
    this.server.listen(this.ports.app, () => {
      console.log(`Main server running on port ${this.ports.app}`)
    })

    // Start API server
    this.apiServer.listen(this.ports.api, () => {
      console.log(`API server running on port ${this.ports.api}`)
    })

    console.log(`WebSocket server running on port ${this.ports.ws}`)
    console.log(`Discord gateway port: ${this.ports.gateway}`)
    console.log(`Debug port: ${this.ports.debug}`)

    return this
  }

  /**
   * Update port configuration
   * @param {object} portConfig - New port configuration
   */
  updatePorts(portConfig) {
    this.ports = { ...this.ports, ...portConfig }
    console.log("Updated port configuration:", this.ports)
    return this
  }
}

// Create and start the bot
const bot = new ProfessionalBot().start()

// Export the bot instance
module.exports = bot

