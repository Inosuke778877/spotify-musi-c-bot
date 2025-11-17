import { EmbedBuilder } from 'discord.js';

export function createEmbed() {
    return new EmbedBuilder()
        .setColor('#028282')
        .setTimestamp();
}
