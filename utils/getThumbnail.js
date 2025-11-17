/**
 * Get thumbnail URL from track info
 * Handles different sources and constructs thumbnails when needed
 * @param {Object} track - The track object from Riffy
 * @returns {string|null} - The thumbnail URL or null
 */
export function getThumbnail(track) {
    // First, check if artworkUrl is provided (Lavalink v4 or plugins)
    if (track.info.artworkUrl) {
        return track.info.artworkUrl;
    }

    // Spotify tracks (from plugin)
    if (track.info.sourceName === 'spotify') {
        return track.info.artworkUrl || null;
    }

    // Deezer tracks (from plugin)
    if (track.info.sourceName === 'deezer') {
        return track.info.artworkUrl || null;
    }

    // Apple Music tracks (from plugin)
    if (track.info.sourceName === 'applemusic') {
        return track.info.artworkUrl || null;
    }

    // YouTube tracks - construct thumbnail from identifier/URI
    if (track.info.sourceName === 'youtube' || track.info.uri?.includes('youtube.com') || track.info.uri?.includes('youtu.be')) {
        let videoId = track.info.identifier;
        
        if (track.info.uri) {
            const match = track.info.uri.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            if (match) {
                videoId = match[1];
            }
        }

        if (videoId) {
            return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
    }

    // SoundCloud thumbnails
    if (track.info.sourceName === 'soundcloud' && track.pluginInfo?.artworkUrl) {
        return track.pluginInfo.artworkUrl;
    }

    // No thumbnail available
    return null;
}
