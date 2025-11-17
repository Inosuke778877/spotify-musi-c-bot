import { Plugin, Track } from 'riffy';

const REGEX = /(?:https:\/\/(?:www\.deezer\.com|link\.deezer\.com)\/(?:[a-zA-Z-]+)\/)?(track|album|playlist)\/(\d+)/;

export class Deezer extends Plugin {
    constructor(options = {}) {
        super();
        this.baseURL = "https://api.deezer.com";
        this.options = options;

        this.functions = {
            track: this.getTrack.bind(this),
            album: this.getAlbum.bind(this),
            playlist: this.getPlaylist.bind(this),
        };
    }

    async load(riffy) {
        this.riffy = riffy;
        this._resolve = riffy.resolve.bind(riffy);
        riffy.resolve = this.resolve.bind(this);
    }

    check(query) {
        return REGEX.test(query);
    }

    // Follow short link if needed
    async resolveLink(url) {
        if (!url.includes("link.deezer.com")) return url;
        try {
            const res = await fetch(url, { method: "HEAD", redirect: "follow" });
            return res.url; // final redirected URL
        } catch (error) {
            console.error('Error resolving Deezer short link:', error);
            return url;
        }
    }

    async resolve({ query, requester }) {
        const node = this.riffy.leastUsedNodes[0];
        const trackLoaded = node.restVersion === "v4" ? "track" : "TRACK_LOADED";
        const playlistLoaded = node.restVersion === "v4" ? "playlist" : "PLAYLIST_LOADED";
        const loadFailed = node.restVersion === "v4" ? "error" : "LOAD_FAILED";

        const finalQuery = query.query || query;
        const resolvedURL = await this.resolveLink(finalQuery); // follow short link
        const [, type, id] = resolvedURL.match(REGEX) || [];

        if (type in this.functions) {
            try {
                const data = await this.functions[type](id);
                const tracks = await Promise.all(
                    data.tracks.map(track => this.buildUnresolved(track, requester))
                );
                const name = ["playlist", "album"].includes(type) ? data.name : null;
                return this.buildResponse(type === "track" ? trackLoaded : playlistLoaded, tracks, name, null);
            } catch (e) {
                console.error('Deezer resolve error:', e);
                return this.buildResponse(loadFailed, null, null, e.message || null);
            }
        }

        return this._resolve({ query, requester });
    }

    async getTrack(id) {
        const data = await fetch(`${this.baseURL}/track/${id}`).then(res => res.json());
        if (data.error) throw new Error(data.error.message);

        return {
            tracks: [{
                id: data.id,
                title: data.title,
                author: data.artist?.name || "Unknown",
                duration: data.duration * 1000,
                // Use highest quality cover: cover_xl (1000x1000) > cover_big (500x500) > cover (250x250)
                thumbnail: data.album?.cover_xl || data.album?.cover_big || data.album?.cover_medium || data.album?.cover || null,
            }],
        };
    }

    async getAlbum(id) {
        const data = await fetch(`${this.baseURL}/album/${id}?limit=100`).then(res => res.json());
        if (data.error) throw new Error(data.error.message);

        // Get album cover (highest quality)
        const albumCover = data.cover_xl || data.cover_big || data.cover_medium || data.cover || null;

        return {
            name: data.title,
            tracks: data.tracks.data.map(track => ({
                id: track.id,
                title: track.title,
                author: track.artist?.name || data.artist?.name || "Unknown",
                duration: track.duration * 1000,
                thumbnail: albumCover, // Use album cover for all tracks
            })),
        };
    }

    async getPlaylist(id) {
        const data = await fetch(`${this.baseURL}/playlist/${id}?limit=100`).then(res => res.json());
        if (data.error) throw new Error(data.error.message);

        return {
            name: data.title,
            tracks: data.tracks.data.map(track => ({
                id: track.id,
                title: track.title,
                author: track.artist?.name || "Unknown",
                duration: track.duration * 1000,
                // Each track uses its own album cover
                thumbnail: track.album?.cover_xl || track.album?.cover_big || track.album?.cover_medium || track.album?.cover || null,
            })),
        };
    }

    async buildUnresolved(track, requester) {
        if (!track) throw new ReferenceError("Deezer track object not provided");
        const node = this.riffy.leastUsedNodes[0];

        return new Track({
            track: "",
            info: {
                identifier: track.id.toString(),
                isSeekable: true,
                author: track.author || "Unknown",
                length: track.duration,
                isStream: false,
                sourceName: "deezer",
                title: track.title,
                uri: `https://www.deezer.com/track/${track.id}`,
                artworkUrl: track.thumbnail || null,
                position: 0,
            },
        }, requester, node);
    }

    async buildResponse(loadType, tracks, name, error) {
        return {
            loadType,
            tracks,
            playlistInfo: name ? { name } : null,
            exception: error ? { message: error, severity: "COMMON" } : null,
        };
    }
}
