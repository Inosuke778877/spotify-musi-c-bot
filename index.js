import { Client, GatewayIntentBits, Collection, AttachmentBuilder } from 'discord.js';
import { Riffy } from 'riffy';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import commandHandler from './handlers/commandHandler.js';
import eventHandler from './handlers/eventHandler.js';
import { loadAllPrefixes } from './handlers/prefixHandler.js';
import { Spotify } from './plugins/spotify.js';
import { Deezer } from './plugins/deezer.js';
import { AppleMusic } from './plugins/applemusic.js';
import { getThumbnail } from './utils/getThumbnail.js';
import emoji from './utils/emoji.js';
import { createEmbed } from './utils/embedBuilder.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();
client.guildPrefixes = new Map();
client.prefix = process.env.PREFIX || '!';

const nodes = [{
    name: 'main-node',
    host: process.env.LAVALINK_HOST || 'localhost',
    port: parseInt(process.env.LAVALINK_PORT) || 2333,
    password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
    secure: process.env.LAVALINK_SECURE === 'true'
}];

client.riffy = new Riffy(client, nodes, {
    send: (payload) => {
        const guild = client.guilds.cache.get(payload.d.guild_id);
        if (guild) guild.shard.send(payload);
    },
    defaultSearchPlatform: "ytmsearch",
    restVersion: "v4"
});

import { Lyrics } from './plugins/lyrics.js';
const lyricsPlugin = new Lyrics({ geniusKey: process.env.GENIUS_API_KEY });
lyricsPlugin.load(client.riffy);

if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    const spotify = new Spotify({
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    });
    spotify.load(client.riffy);
    console.log('✅ Spotify plugin loaded');
}

const deezer = new Deezer();
deezer.load(client.riffy);
console.log('✅ Deezer plugin loaded');

const appleMusic = new AppleMusic();
appleMusic.load(client.riffy);
console.log('✅ Apple Music plugin loaded');

client.riffy.on("nodeConnect", node => {
    console.log(`✅ Node "${node.name}" connected`);
});

client.riffy.on("nodeError", (node, error) => {
    console.error(`❌ Node "${node.name}" error:`, error.message);
});

client.riffy.on("nodeDisconnect", (node) => {
    console.log(`⚠️ Node "${node.name}" disconnected`);
});

client.riffy.on("trackStart", async (player, track) => {
    const channel = client.channels.cache.get(player.textChannel);
    if (!channel) return;

    try {
        const thumbnail = getThumbnail(track);
        
        const musicCard = await Dynamic({
            thumbnailImage: thumbnail || 'https://cdn.discordapp.com/attachments/1220001571228880917/1220001571690123284/01.png',
            backgroundImage: thumbnail || 'https://your-background-image-url.png',  // Add background image
            imageDarkness: 60,
            progress: 0,
            progressColor: '#ffffff',
            progressBarColor: '#5F2D00',
            name: track.info.title.length > 30 ? track.info.title.substring(0, 30) + '...' : track.info.title,
            nameColor: '#ffffff',
            author: track.info.author.length > 30 ? track.info.author.substring(0, 30) + '...' : track.info.author,
            authorColor: '#696969',
        });

        const attachment = new AttachmentBuilder(musicCard, { name: 'musiccard.png' });

        const embed = createEmbed()
            .setTitle(`${emoji.music} Now Playing`)
            .setDescription(`**[${track.info.title}](${track.info.uri})**`)
            .addFields(
                { name: `${emoji.author} Author`, value: track.info.author, inline: true },
                { name: `${emoji.duration} Duration`, value: formatTime(track.info.length), inline: true },
                { name: `${emoji.info} Source`, value: track.info.sourceName || 'Unknown', inline: true }
            )
            .setImage('attachment://musiccard.png');

        if (track.requester) {
            embed.setFooter({ 
                text: `Requested by ${track.requester.tag}`, 
                iconURL: track.requester.displayAvatarURL() 
            });
        }

        channel.send({ embeds: [embed], files: [attachment] }).catch(console.error);
    } catch (error) {
        console.error('Error creating music card:', error);
        
        const embed = createEmbed()
            .setTitle(`${emoji.music} Now Playing`)
            .setDescription(`**[${track.info.title}](${track.info.uri})**`)
            .addFields(
                { name: `${emoji.author} Author`, value: track.info.author, inline: true },
                { name: `${emoji.duration} Duration`, value: formatTime(track.info.length), inline: true },
                { name: `${emoji.info} Source`, value: track.info.sourceName || 'Unknown', inline: true }
            );

        const thumbnail = getThumbnail(track);
        if (thumbnail) embed.setThumbnail(thumbnail);

        if (track.requester) {
            embed.setFooter({ 
                text: `Requested by ${track.requester.tag}`, 
                iconURL: track.requester.displayAvatarURL() 
            });
        }

        channel.send({ embeds: [embed] }).catch(console.error);
    }
});

client.riffy.on("queueEnd", async (player) => {
    const channel = client.channels.cache.get(player.textChannel);
    
    if (player.twentyFourSeven) {
        if (channel && !player.isAutoplay) {
            const embed = createEmbed()
                .setDescription(`${emoji.info} Queue ended. 24/7 mode is active, staying in voice channel.`);
            channel.send({ embeds: [embed] }).catch(console.error);
        }
        
        if (player.isAutoplay) {
            await player.autoplay(player);
        }
        return;
    }

    if (player.isAutoplay) {
        await player.autoplay(player);
    } else {
        if (channel) {
            const embed = createEmbed()
                .setDescription(`${emoji.success} Queue has ended. Leaving voice channel.`);
            channel.send({ embeds: [embed] }).catch(console.error);
        }
        
        setTimeout(() => {
            if (player && !player.playing) player.destroy();
        }, 1000);
    }
});

client.riffy.on("trackError", async (player, track, error) => {
    const channel = client.channels.cache.get(player.textChannel);
    if (!channel) return;

    console.error(`Track error: ${track.info.title}`, error);

    const embed = createEmbed()
        .setDescription(`${emoji.error} Error playing **${track.info.title}**`);

    channel.send({ embeds: [embed] }).catch(console.error);
});

client.riffy.on("trackStuck", async (player, track, thresholdMs) => {
    const channel = client.channels.cache.get(player.textChannel);
    if (!channel) return;

    const embed = createEmbed()
        .setDescription(`${emoji.warning} Track **${track.info.title}** stuck. Skipping...`);

    channel.send({ embeds: [embed] }).catch(console.error);
    
    if (player.queue.length > 0) {
        player.stop();
    } else {
        player.destroy();
    }
});

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB');
        await loadAllPrefixes(client);
    })
    .catch(err => console.error('❌ MongoDB error:', err));

mongoose.connection.on('error', err => console.error('MongoDB error:', err));
mongoose.connection.on('disconnected', () => console.log('⚠️ MongoDB disconnected'));

commandHandler(client);
eventHandler(client);

client.on("raw", d => {
    if (client.riffy) client.riffy.updateVoiceState(d);
});

client.once('clientReady', (c) => {
    console.log(`✅ Ready! Logged in as ${c.user.tag}`);
    console.log(`📊 Serving ${client.guilds.cache.size} guilds`);
    
    client.riffy.init(client.user.id);
    client.user.setActivity(`${client.prefix}help | Music 🎵`, { type: 2 });
});

client.on('error', error => console.error('Client error:', error));
client.on('warn', info => console.warn('Client warning:', info));

process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    
    if (client.riffy && client.riffy.players) {
        client.riffy.players.forEach(player => {
            try {
                player.destroy();
            } catch (err) {
                console.error('Error destroying player:', err);
            }
        });
    }
    
    mongoose.connection.close(() => {
        console.log('✅ MongoDB closed');
    });
    
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received');
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

function formatTime(ms) {
    if (!ms || isNaN(ms)) return '00:00';
    
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    return hours > 0
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        : `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export { formatTime };

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('❌ Failed to login:', error);
    process.exit(1);
});