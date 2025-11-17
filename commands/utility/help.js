import emoji from '../../utils/emoji.js';
import { createEmbed } from '../../utils/embedBuilder.js';

export default {
    name: 'help',
    description: 'Show all commands',
    execute: async (message, args, client) => {
        const embed = createEmbed()
            .setTitle(`${emoji.info} Help Menu`)
            .addFields(
                { 
                    name: `${emoji.music} Music Commands`, 
                    value: '`play`, `pause`, `resume`, `skip`, `stop`, `queue`, `nowplaying`, `volume`, `seek`, `loop`, `shuffle`',
                    inline: false
                },
                { 
                    name: `${emoji.filter} Filter Commands`, 
                    value: '`bassboost`, `nightcore`, `vaporwave`, `8d`, `karaoke`, `tremolo`, `vibrato`, `rotation`, `distortion`, `channelmix`, `lowpass`, `slowmode`, `timescale`, `clearfilters`',
                    inline: false
                },
                { 
                    name: `${emoji.playlist} Playlist Commands`, 
                    value: '`createplaylist`, `deleteplaylist`, `addtoplaylist`, `removefromplaylist`, `loadplaylist`, `myplaylists`',
                    inline: false
                },
                { 
                    name: `${emoji.info} Utility Commands`, 
                    value: '`help`, `ping`',
                    inline: false
                }
            );

        message.channel.send({ embeds: [embed] });
    }
};
