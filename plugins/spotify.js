import { Plugin, Track } from 'riffy';

const REGEX = /(?:https:\/\/open\.spotify\.com\/|spotify:)(.+)(?:[\/:])([A-Za-z0-9]+)/;

export class Spotify extends Plugin {
    constructor(options) {
        super();
        this.baseURL = 'https://api.spotify.com/v1';
        this.token = '';
        this.options = options;
        this.authorization = Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString('base64');
        this.interval = 0;

        this.functions = {
            track: this.getTrack.bind(this),
            album: this.getAlbum.bind(this),
            playlist: this.getPlaylist.bind(this)
        };

        this.renew();
    }

    async load(riffy) {
        this.riffy = riffy;
        this._resolve = riffy.resolve.bind(riffy);
        riffy.resolve = this.resolve.bind(this);
    }

    check(query) {
        return REGEX.test(query);
    }

    async resolve({ query, requester }) {
        let trackLoaded = "",
            playlistLoaded = "",
            loadFailed = "";

        const node = this.riffy.leastUsedNodes[0];
        
        if (node.restVersion === "v4") {
            trackLoaded = "track";
            playlistLoaded = "playlist";
            loadFailed = "error";
        } else {
            trackLoaded = "TRACK_LOADED";
            playlistLoaded = "PLAYLIST_LOADED";
            loadFailed = "LOAD_FAILED";
        }

        if (!this.token) await this.requestToken();
        const finalQuery = query.query || query;
        const [, type, id] = finalQuery.match(REGEX) || [];

        if (type in this.functions) {
            try {
                const func = this.functions[type];

                if (!func) {
                    throw new Error('Incorrect type for Spotify URL, must be one of "track", "album" or "playlist".');
                }

                const data = await func(id);
                const loadType = type === "track" ? trackLoaded : playlistLoaded;
                const name = ["playlist", "album"].includes(type) ? data.name : null;

                const tracks = await Promise.all(data.tracks.map(async query => {
                    const track = await this.buildUnresolved(query, requester);
                    return track;
                }));

                return this.buildResponse(loadType, tracks, name, null);
            } catch (e) {
                return this.buildResponse(e.loadType || loadFailed, null, null, e.message || null);
            }
        }

        return this._resolve({ query, requester });
    }

    async getTrack(id) {
        if (!this.token) await this.requestToken();
        const data = await fetch(`${this.baseURL}/tracks/${id}`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        }).then(async res => await res.json());

        return {
            tracks: [{
                id: data.id,
                title: data.name,
                author: data.artists[0].name,
                duration: data.duration_ms,
                // Get highest quality album artwork
                thumbnail: data.album?.images?.[0]?.url || null
            }]
        };
    }

    async getAlbum(id) {
        if (!this.token) await this.requestToken();
        const data = await fetch(`${this.baseURL}/albums/${id}`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        }).then(async res => await res.json());

        // Get album artwork (highest quality)
        const albumArtwork = data.images?.[0]?.url || null;

        return {
            name: data.name,
            thumbnail: albumArtwork,
            tracks: data.tracks.items.map(track => ({
                id: track.id,
                title: track.name,
                author: track.artists[0].name,
                duration: track.duration_ms,
                thumbnail: albumArtwork // Use album artwork for all tracks
            }))
        };
    }

    async getPlaylist(id) {
        if (!this.token) await this.requestToken();
        const data = await fetch(`${this.baseURL}/playlists/${id}`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
            },
        }).then(async res => await res.json());

        // Get playlist artwork (highest quality)
        const playlistArtwork = data.images?.[0]?.url || null;

        return {
            name: data.name,
            thumbnail: playlistArtwork,
            tracks: data.tracks.items.map(item => ({
                id: item.track.id,
                title: item.track.name,
                author: item.track.artists[0].name,
                duration: item.track.duration_ms,
                // Use track's album artwork, fallback to playlist artwork
                thumbnail: item.track.album?.images?.[0]?.url || playlistArtwork
            }))
        };
    }

    async requestToken() {
        try {
            const requestBody = new URLSearchParams();
            requestBody.append('grant_type', 'client_credentials');
            requestBody.append('client_id', this.options.clientId);
            requestBody.append('client_secret', this.options.clientSecret);

            const requestOptions = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: requestBody,
            };

            const res = await fetch("https://accounts.spotify.com/api/token", requestOptions)
                .then(async res => await res.json());

            this.token = res.access_token;
            this.interval = res.expires_in * 1000;
        } catch (e) {
            if (e.status === 400) {
                throw new Error('The client ID or client secret is incorrect.');
            }
        }
    }

    async renew() {
        await this.requestToken();
        setTimeout(() => this.renew(), this.interval);
    }

    async buildUnresolved(track, requester) {
        if (!track) throw new ReferenceError('The Spotify track object was not provided');

        const node = this.riffy.leastUsedNodes[0];

        return new Track(
            {
                track: "",
                info: {
                    identifier: track.id,
                    isSeekable: true,
                    author: track.author || "Unknown",
                    length: track.duration,
                    isStream: false,
                    sourceName: "spotify",
                    title: track.title,
                    uri: `https://open.spotify.com/track/${track.id}`,
                    artworkUrl: track.thumbnail, // Use Spotify album artwork
                    position: 0,
                },
            },
            requester,
            node
        );
    }

    async buildResponse(loadType, tracks, name, error) {
        return Object.assign(
            {
                loadType,
                tracks,
                playlistInfo: name ? {
                    name
                } : null,
                exception: error ? {
                    message: error,
                    severity: 'COMMON',
                } : null
            }
        );
    }
}
