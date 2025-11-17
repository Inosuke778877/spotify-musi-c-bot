import { EmbedBuilder } from 'discord.js';

export function createEmbed() {
    return new EmbedBuilder()
        .setColor('#00FF00')
        .setTimestamp();
}
