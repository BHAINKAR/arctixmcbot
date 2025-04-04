// Professional Discord Bot - Command Handler for BotGhost
// This script allows administrators to change the bot's status and About Me section

// Import required modules
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Validate environment variables
if (!process.env.TOKEN) {
  console.error('ERROR: Bot token not found in environment variables!');
  console.error('Please create a .env file with TOKEN=your_bot_token');
  process.exit(1);
}

// Create a new Discord client with appropriate intents
const bot = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences
  ] 
});

// Activity type mapping for easier reference
const ACTIVITY_TYPES = {
  PLAYING: ActivityType.Playing,
  LISTENING: ActivityType.Listening,
  WATCHING: ActivityType.Watching,
  COMPETING: ActivityType.Competing,
  STREAMING: ActivityType.Streaming,
  CUSTOM: ActivityType.Custom
};

// Format activity type for display
function formatActivityType(type) {
  const typeMap = {
    [ActivityType.Playing]: 'Playing',
    [ActivityType.Listening]: 'Listening to',
    [ActivityType.Watching]: 'Watching',
    [ActivityType.Competing]: 'Competing in',
    [ActivityType.Streaming]: 'Streaming',
    [ActivityType.Custom]: 'Custom'
  };
  
  return typeMap[type] || 'Unknown';
}

// Initialize the bot with default status when it starts up
bot.on('ready', () => {
  console.log(`✅ Bot is online and ready! Logged in as ${bot.user.tag}`);
  
  // Set default status to "Playing Minecraft"
  bot.user.setActivity('Minecraft', { type: ActivityType.Playing });
  console.log('📊 Default status set: Playing Minecraft');
  
  // Log the current About Me
  console.log(`ℹ️ Current About Me: "${bot.user.presence?.activities?.[0]?.state || 'None'}"`)
});

// Command handler for slash commands
bot.on('interactionCreate', async interaction => {
  // Check if the interaction is a slash command
  if (!interaction.isCommand()) return;
  
  // Extract command name
  const { commandName } = interaction;
  
  // Check if user has administrator permissions
  const isAdmin = interaction.member.permissions.has('Administrator');
  
  // Handle different commands
  try {
    switch (commandName) {
      case 'changestatus':
        await handleChangeStatus(interaction, isAdmin);
        break;
      case 'setaboutme':
        await handleSetAboutMe(interaction, isAdmin);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown command.',
          ephemeral: true
        });
    }
  } catch (error) {
    handleCommandError(error, interaction);
  }
});

// Handler for the changestatus command
async function handleChangeStatus(interaction, isAdmin) {
  // Check if the user has administrator permissions
  if (!isAdmin) {
    return interaction.reply({
      content: '❌ You need administrator permissions to use this command.',
      ephemeral: true
    });
  }
  
  // Get the status type and text from the command options
  const statusType = interaction.options.getString('type');
  const statusText = interaction.options.getString('text');
  
  if (!statusText) {
    return interaction.reply({
      content: '❌ Please provide a status text.',
      ephemeral: true
    });
  }
  
  // Get the activity type
  const activityType = ACTIVITY_TYPES[statusType];
  
  // Set the new status based on the type
  if (statusType === 'STREAMING') {
    // Streaming status requires a URL
    bot.user.setActivity(statusText, { 
      type: activityType,
      url: 'https://www.twitch.tv/directory' // Default Twitch URL
    });
  } else {
    // Standard activity types
    bot.user.setActivity(statusText, { type: activityType });
  }
  
  // Format the status type for display
  const formattedType = formatActivityType(activityType);
  
  // Confirm the status change
  await interaction.reply({
    content: `✅ Bot status updated to: ${formattedType} ${statusText}`,
    ephemeral: true
  });
  
  console.log(`📊 Status changed to: ${formattedType} ${statusText} by ${interaction.user.tag}`);
}

// Handler for the setaboutme command
async function handleSetAboutMe(interaction, isAdmin) {
  // Check if the user has administrator permissions
  if (!isAdmin) {
    return interaction.reply({
      content: '❌ You need administrator permissions to use this command.',
      ephemeral: true
    });
  }
  
  // Get the about me text from the command options
  const aboutMeText = interaction.options.getString('text');
  
  if (!aboutMeText) {
    return interaction.reply({
      content: '❌ Please provide text for the About Me section.',
      ephemeral: true
    });
  }
  
  try {
    // Get current activity to preserve it
    const currentActivity = bot.user.presence.activities[0];
    
    // Set the activity with the new state (About Me)
    bot.user.setActivity(currentActivity?.name || 'Minecraft', {
      type: currentActivity?.type || ActivityType.Playing,
      state: aboutMeText
    });
    
    // Confirm the about me change
    await interaction.reply({
      content: `✅ Bot About Me updated to: "${aboutMeText}"`,
      ephemeral: true
    });
    
    console.log(`ℹ️ About Me changed to: "${aboutMeText}" by ${interaction.user.tag}`);
  } catch (error) {
    console.error('Error setting About Me:', error);
    await interaction.reply({
      content: '❌ An error occurred while updating the About Me section.',
      ephemeral: true
    });
  }
}

// Error handler for commands
function handleCommandError(error, interaction) {
  console.error('Command error:', error);
  
  // Provide more detailed error feedback
  let errorMessage = '❌ An error occurred while processing your command.';
  
  if (error.code) {
    errorMessage += ` Error code: ${error.code}`;
  }
  
  // Reply with error if interaction hasn't been replied to yet
  if (!interaction.replied && !interaction.deferred) {
    interaction.reply({
      content: errorMessage,
      ephemeral: true
    }).catch(console.error);
  }
}

// Register the slash commands when deploying the bot
async function registerCommands() {
  const commands = [
    {
      name: 'changestatus',
      description: 'Change the bot\'s status (Admin only)',
      options: [
        {
          name: 'type',
          type: 3, // STRING type
          description: 'The type of status',
          required: true,
          choices: [
            { name: 'Playing', value: 'PLAYING' },
            { name: 'Listening to', value: 'LISTENING' },
            { name: 'Watching', value: 'WATCHING' },
            { name: 'Competing in', value: 'COMPETING' },
            { name: 'Streaming', value: 'STREAMING' },
            { name: 'Custom', value: 'CUSTOM' }
          ]
        },
        {
          name: 'text',
          type: 3, // STRING type
          description: 'The new status text',
          required: true
        }
      ]
    },
    {
      name: 'setaboutme',
      description: 'Set the bot\'s About Me section (Admin only)',
      options: [
        {
          name: 'text',
          type: 3, // STRING type
          description: 'The new About Me text',
          required: true
        }
      ]
    }
  ];
  
  // Register commands with Discord API
  try {
    console.log('📝 Registering slash commands...');
    await bot.application.commands.set(commands);
    console.log('✅ Slash commands registered successfully');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
    throw new Error(`Failed to register commands: ${error.message}`);
  }
}

// Comprehensive error handling for the bot
bot.on('error', error => {
  console.error('❌ Bot error:', error);
});

bot.on('warn', warning => {
  console.warn('⚠️ Bot warning:', warning);
});

bot.on('disconnect', () => {
  console.warn('🔌 Bot disconnected! Attempting to reconnect...');
});

bot.on('reconnecting', () => {
  console.log('🔄 Bot reconnecting...');
});

// Login to Discord with the bot token from environment variables
bot.login(process.env.TOKEN).then(() => {
  console.log('🔑 Bot logged in successfully');
}).catch(error => {
  console.error('❌ Failed to login:', error);
  process.exit(1);
});

// Uncomment to register commands when deploying the bot
// bot.once('ready', () => {
//   registerCommands().catch(console.error);
// });

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('👋 Bot shutting down...');
  bot.destroy();
  process.exit(0);
});

process.on('uncaughtException', error => {
  console.error('❌ Uncaught exception:', error);
});

process.on('unhandledRejection', error => {
  console.error('❌ Unhandled promise rejection:', error);
});

// Export the bot for potential use in other files
module.exports = bot;