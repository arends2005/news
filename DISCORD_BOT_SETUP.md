Now, here's what you need to do in the Discord Developer Portal:

1. Click on your "url-uploader" application
Go to the "Bot" section in the left sidebar
Scroll down to "Privileged Gateway Intents"
Enable these intents:
MESSAGE CONTENT INTENT
SERVER MEMBERS INTENT
PRESENCE INTENT

2. Go to your application's OAuth2 → URL Generator
Under "Scopes" select:
bot
message.read
applications.commands
Under "Bot Permissions" select:
View Channels (under "General Permissions")
Send Messages (under "Text Permissions")
Add Reactions (under "Text Permissions")
Read Message History (under "Text Permissions")
Manage Messages (to delete messages)

DISCORD_REDIRECT_URI=http://localhost:3000/discord/callback

Use the generated URL at the bottom of the page to add the bot to your server
Let's rebuild the container with these updated intents:


https://discord.com/oauth2/authorize?client_id=1346018921068625930&permissions=76864&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fdiscord%2Fcallback&integration_type=0&scope=bot+messages.read+applications.commands