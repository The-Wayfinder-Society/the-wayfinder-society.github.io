const SpotifyWebApi = require('spotify-web-api-node');
const base64url = require('base64url');
const Cookies = require("js-cookie");

const viz = require("./viz");
const pako = require('pako');

let clientId = "d85de6c0c70241d1befe36e2c2d382e3";
// let redirectUri = "http://localhost:5000/callback";
let redirectUri = window.location.origin + "/callback";

let spotifyApi = new SpotifyWebApi();

async function auth() {
    function redirectForAuthorizationCode(code_challenge) {
        let data = {
            "client_id": clientId,
            "response_type": "code",
            "redirect_uri": redirectUri,
            "scope": "user-library-read,user-read-recently-played,user-top-read,playlist-read-private",
            "code_challenge": code_challenge,
            "code_challenge_method": "S256"
        }
        let query = new URLSearchParams(data).toString();
        let auth_uri = "https://accounts.spotify.com/authorize?" + query;
        // redirect
        console.log("redirecting to spotify for auth");
        window.location.replace(auth_uri);
    }

    async function getAccessToken(authorization_code, code_verifier) {
        let token_uri = `https://accounts.spotify.com/api/token`
        let data = {
            "client_id": clientId,
            "grant_type": "authorization_code",
            "code": authorization_code,
            "redirect_uri": redirectUri,
            "code_verifier": code_verifier,
        };

        let method = "POST";
        let headers = new Headers();
        headers.set("Content-Type", 'application/x-www-form-urlencoded');
        let body = new URLSearchParams(data).toString(); 
        console.log(body);

        let promise = fetch(token_uri, {
            method: method, 
            body: body,
            headers: headers,
        }).then(response => {
            console.log("Request complete! response:", response);
            return response.json().then(
                function(response_body) {
                    let access_token = response_body['access_token'];
                    let refresh_token = response_body['refresh_token'];
                    let expires_in = response_body['expires_in'];
                    expires_in = new Date(new Date().getTime() + (parseInt(expires_in) - 10)  * 1000);
                    console.log("expires in: " + expires_in);
                    Cookies.set("access_token", access_token, {expires: expires_in});
                    Cookies.set("refresh_token", refresh_token);
                    return [access_token, refresh_token];
                }
            );
        });
        return promise;
    }

    async function getRefreshedAccessToken(refresh_token) {
        let token_uri = `https://accounts.spotify.com/api/token`
        let data = {
            "client_id": clientId,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        };

        let method = "POST";
        let headers = new Headers();
        headers.set("Content-Type", 'application/x-www-form-urlencoded');
        let body = new URLSearchParams(data).toString(); 
        console.log(body);

        let promise = fetch(token_uri, {
            method: method, 
            body: body,
            headers: headers,
        }).then(response => {
            console.log("Request complete! response:", response);
            return response.json().then(
                function(response_body) {
                    let access_token = response_body['access_token'];
                    let refresh_token = response_body['refresh_token'];
                    let expires_in = response_body['expires_in'];
                    expires_in = new Date(new Date().getTime() + (parseInt(expires_in) - 10)  * 1000);
                    console.log("expires in: " + expires_in);
                    Cookies.set("access_token", access_token, {expires: expires_in});
                    Cookies.set("refresh_token", refresh_token);
                    return [access_token, refresh_token];
                }
            );
        });
        return promise;
    }


    // https://stackoverflow.com/questions/18118824/javascript-to-generate-random-password-with-specific-number-of-letters
    function cryptoRandomString(length) {
        // https://developer.spotify.com/documentation/general/guides/authorization-guide/#authorization-code-flow-with-proof-key-for-code-exchange-pkce
        // It can contain letters, digits, underscores, periods, hyphens, or tildes.
        let charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.-~";
        let i;
        let result = "";
        // https://developer.mozilla.org/en-US/docs/Web/API/Window/crypto
        let crypto = window.crypto || window.msCrypto; // for IE 11
        values = new Uint32Array(length);
        crypto.getRandomValues(values);
        for(i = 0; i < length; i++) {
            result += charset[values[i] % charset.length];
        }
        return result;
    }
    
    async function createChallengeVerifierAndCode() {
        let code_verifier = cryptoRandomString(128);
        let code_verifier_bytes = (new TextEncoder()).encode(code_verifier);
        let hash = await window.crypto.subtle.digest("SHA-256", code_verifier_bytes);
        let code_challenge = base64url(hash);
        return [code_verifier, code_challenge];
    }

    // Check url for auth information
    if (urlParams.get("error")) {
        console.log("User denied access");
    } else if (urlParams.get("code")) {
        let authorization_code = urlParams.get("code");
        console.log("Got auth token: " + authorization_code);
        Cookies.set("authorization_code", authorization_code);
    }

    // Check cookies for auth information
    let code_challenge = Cookies.get("code_challenge");
    let code_verifier = Cookies.get("code_verifier");
    let authorization_code = Cookies.get("authorization_code");
    let access_token = Cookies.get("access_token");
    let refresh_token = Cookies.get("refresh_token");

    if (access_token) {
        console.log("have access token");
        return Promise(() => {return [access_token, refresh_token]});
    }

    if (authorization_code && code_verifier) {
        // We've generated an auth_code and code_verifier
        // and been redirected to /callback 
        let access_and_refresh_tokens = getAccessToken(authorization_code, code_verifier);
        Cookies.remove("code_challenge");
        Cookies.remove("code_verifier");
        Cookies.remove("authorization_code");
        return access_and_refresh_tokens;
    } else {
        if (refresh_token) {
            // We have a refresh token on hand and need to get a new access and refresh token
            let access_and_refresh_tokens = getRefreshedAccessToken(refresh_token);
            return access_and_refresh_tokens
        } else {
            // We are starting the auth flow and need to generate a code_verifier and code_challange
            // before redirecting to spotify for an auth_code
            let result = await createChallengeVerifierAndCode();
            code_verifier = result[0];
            code_challenge = result[1];
            Cookies.set("code_verifier", code_verifier);
            Cookies.set("code_challenge", code_challenge);
            redirectForAuthorizationCode(code_challenge);    
        }
    }    
}

function logout() {
    Cookies.remove("code_challenge");
    Cookies.remove("code_verifier");
    Cookies.remove("authorization_code");
    Cookies.remove("access_token");
    Cookies.remove("refresh_token");
    // window.location.reload();
    window.location.replace("/");
}

function initApi() {
    let access_token = Cookies.get("access_token");
    let refresh_token = Cookies.get("refresh_token");
    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);
}

// From: https://github.com/thelinmichael/spotify-web-api-node/issues/217
async function callWithRetry(func, retries=0, max_retries=10) {
    try {
        // console.log("calling func");
        return await func();
    } catch (e) {
        console.log("caught error and trying again");
        if (retries <= max_retries) {
            if (e && e.statusCode === 429) {
                // +1 sec leeway
                const retryAfter = (parseInt(e.headers['retry-after'], 10)) * 1000;
                console.log(`sleeping for: ${retryAfter.toString()}`);
                await new Promise((r) => setTimeout(r, retryAfter));
            }
            return await callWithRetry(func, retries + 1, max_retries);
        } else {
            console.log("hit max retries!")
            throw e;
        }
    }    
}

function callWithOffsetAndLimit(f, offset, limit) {
    return () => {return f({"limit": limit, "offset": offset})};
}

async function enumerateTracks(offset, limit) {
    console.log("getting tracks at " + offset);
    let func = () => {
        return spotifyApi.getMySavedTracks({
            "limit": limit,
            "offset": offset
        })
    }
    return callWithRetry(func, 0, 10).then(
        function(response) {
            console.log("got tracks at: " + offset + " response: " + response);
            let retDict = {};
            for (let [index, track] of response.body.items.entries()) {
                retDict[index + offset] = track;
            }
            return retDict;
        },
        function(error) {
            console.log("error " + error + " at " + offset);
            return {};
        }
    )
}

async function getAllTracks() {
    initApi();

    return spotifyApi.getMySavedTracks().then(
        function (response) {
            console.log("getting all tracks");
            let total = response.body.total;
            let limit = 50;
            let numCalls = parseInt(total / limit) + 1;
            let allData = {};
            let promises = [];
            for (let i = 0; i < numCalls; i++) {
                promises.push(enumerateTracks(i * limit, limit));
            };
            return Promise.all(promises).then(function (allResults) {
                console.log("resolved promises: " + allResults);
                for (let result of allResults) {
                    for (let index in result) {
                        console.log("got data for " + index);
                        allData[index] = result[index];
                    }
                }
                return allData
            }, function(error) {
                console.log("Error resolving promises: " + error);
            });
        }
    )
}

// Unpacks a response from /v1/me/tracks into the desired format
async function unpackTracksResponse(response) {
    let itemsKeysToKeep = ["added_at", "played_at"];
    let trackKeysToKeep = ["artists", "id", "name", "popularity", "uri"];
    let ret = [];
    for (let [idx, item] of response.body.items.entries()) {
        let keep = {};
        for (let key of itemsKeysToKeep) {
            keep[key] = item[key];
        }
        for (let key of trackKeysToKeep) {
            keep[key] = item.track[key];
        }
        ret.push(keep);
    }
    return ret
}

// unpack results from /v1/artists
async function unpackArtistsResponse(response) {
    let artistsKeysToKeep = ["genres", "id",  "name", "popularity", "uri"];
    let ret = [];
    console.log("unpacking " + response.body.artists.length + " artists");
    for (let artist of response.body.artists) {
        let keep = {};
        for (let key of artistsKeysToKeep) {
            keep[key] = artist[key];
        }
        ret.push(keep);
    }
    return ret
}

// unpack results from /v1/audio-features
async function unpackTrackFeaturesResponse(data) {
    let ids = data[0];
    let response = data[1];
    // TODO: thin which features to keep?
    console.log("Features response: ", response, "for ids: ", ids);
    if (response.body.audio_features) {
        return response.body.audio_features;
    } else {
        throw new Error("no audio_features in response" + response.toString());
    }   
}

async function savedTracks() {
    // spotifyApi.getMySavedTracks().then(console.log, console.log);
    let librarySize = (await callWithRetry(() => {return spotifyApi.getMySavedTracks()})).body.total;
    let limit = 50;
    let numCalls = parseInt(librarySize / limit);
    let remainder = (librarySize / limit) - numCalls;
    if (remainder > 0) {
        numCalls += 1;
    }
    // numCalls = 5;
    let promises = [];
    for (let i = 0; i < numCalls; i++) {
        promises.push(
            callWithRetry(
                () => {return spotifyApi.getMySavedTracks({"offset": i * limit, "limit": limit})}
            ).then(unpackTracksResponse, (e) => {throw e})
        );
    }
    let allTracks = await Promise.all(promises).then(
        (result) => {console.log("Got all tracks!"); return result},
        (error) => {console.log("Error while getting all tracks"); throw error}
    );
    let ret = [];
    for (let i = 0; i < numCalls; i++) {
        for (let track of allTracks[i]) {
            ret.push(track);
        }
    }
    return ret;
}

async function featurizeTracks(tracks) {
    let trackIds = [];
    for (let track of tracks) {
        trackIds.push(track.id);
    }
    let promises = [];
    // Get features in chunks of 100 (max number of ids)
    // Make arrays of size 100...
    let limit = 100;
    let numCalls = Math.floor(trackIds.length / limit);
    let remainder = trackIds.length - numCalls * limit;
    if (remainder > 0) {
        numCalls += 1;
    }
    // numCalls = 70;
    console.log("calling", numCalls, "times");
    promises = [];
    let idSplits = [];
    let call = async function(i, ids) {
        console.log("[inside] call number", i, "ids are", ids);
        return callWithRetry(() => {
            return spotifyApi.getAudioFeaturesForTracks(ids).then(
            function (response) {
                return [ids, response];
            })
        });
    }
    for (let i = 0; i < numCalls; i++) {
        idSplits.push(trackIds.slice(i * limit, (i + 1) * limit));
        promises.push(
            call(
                i * 1, idSplits[i * 1]
            ).then(
                unpackTrackFeaturesResponse, 
                (e) => {console.log("[featurizeTracks] error:", e); throw e}
            )
        );
    }

    let featuresResults = await Promise.all(promises).then(
        (result) => {console.log("Got all features!"); return result;},
        (error) => {console.log("Error while getting all features"); return error;}
    );
    console.log("[featurizeTracks] " + featuresResults.length + " audio-features api calls resolved");
    let features = {};
    for (let featuresResult of featuresResults) {
        console.log("[featurizeTracks] " + featuresResult.length  + " audio-features from call")
        if (featuresResult.length < 100) {
            console.log("[featurizeTracks] featuresResult =", featuresResult);
        } 
        for (let trackFeatures of featuresResult) {
            features[trackFeatures.id] = trackFeatures;
        }
    }
    console.log("[featurizeTracks] Requested features for " + trackIds.length + " tracks and got " + Object.keys(features).length);
    return features
}

async function genresForTracks(tracks) {
    // Use a Set so that we only call the API for each id once
    let artistIds = new Set();
    let totalArtists = 0;
    for (let track of tracks) {
        for (let artist of track.artists) {
            artistIds.add(artist.id);
            totalArtists += 1;
        }
    }
    let numArtists = artistIds.size;
    let promises = [];
    let artistIdBuffer = [];
    // Get artists in chunks of 50 (max number of ids)
    for (let artistId of artistIds) {
        if (artistIdBuffer.length < 49) {
            artistIdBuffer.push(artistId);
        } else {
            artistIdBuffer.push(artistId);
            let bufferClone = artistIdBuffer.slice();
            promises.push(callWithRetry(() => {
                return spotifyApi.getArtists(bufferClone)
            }).then(unpackArtistsResponse, (e) => {throw e}));
            artistIdBuffer = [];
        }
    }
    // Finish remaining artists if number of tracks is not a multiple of 50
    if (artistIdBuffer.length > 0) {
        let bufferClone = artistIdBuffer.slice();
        promises.push(callWithRetry(() => {
            return spotifyApi.getArtists(bufferClone)
        }).then(unpackArtistsResponse, (e) => {throw e}));
        artistIdBuffer = [];
    }
    let artistsResults = await Promise.all(promises).then(
        (result) => {console.log("Got all artists!"); return result},
        (error) => {console.log("Error while getting all artists"); throw error}
    );
    let artistsKeyedById = {};
    let numArtistResults = 0;
    for (let artistResult of artistsResults) {
        numArtistResults += artistResult.length;
    }
    console.log("Total " + totalArtists + ", requested " + numArtists + " artists, and got " + numArtistResults);
    for (let artistResult of artistsResults) {
        console.log(artistResult.length + " artists in result");
        for (let artist of artistResult) {
            artistsKeyedById[artist.id] = artist;
        }
    }
    let genres = [];
    for (let track of tracks) {
        let artists = track.artists;
        let trackGenres = [];
        for (let artist of artists) {
            let artistResult = artistsKeyedById[artist.id];
            if (artistResult) {
                for (let genre of artistResult.genres) {
                    trackGenres.push(genre);
                }
            } else {
                console.log("information for artist " + artist.name + " was not gathered");
                console.log(artistResult);
                console.log(artist.id);
            }
        }
        genres.push(trackGenres);
    }
    return genres
}

async function formatTracksForViz(tracks) {
    let featuresToUse = [
        'energy', 'liveness', 'speechiness', 'acousticness', 'instrumentalness', 
        'danceability', 'loudness', 'valence', 'tempo'
    ];
    for (let track of tracks) {
        if (track.added_at) {
            track.date = track.added_at;
        } else {
            track.date = track.played_at;
        }
        track._artists = track.artists;
        let artistNames = [];
        for (let artist of track._artists) {
            artistNames.push(artist.name);
        }
        track.artists = artistNames;
        if (track.audio_features) {
            for (let feature of featuresToUse) {
                track[feature] = track.audio_features[feature];
            }
        } else {
            // console.log("error: track " + track.name + " has no features", track);
        }
    }
    return tracks;
}

async function library() {
    // First, get all the songs in the library
    let tracks = await savedTracks();
    // Get features for all tracks
    let features = await featurizeTracks(tracks);
    // Coalesce tracks and features
    for (let idx in tracks) {
        tracks[idx].audio_features = features[tracks[idx].id];
    }
    // Get artist genres for all tracks
    let genres = await genresForTracks(tracks);
    for (let idx in tracks) {
        tracks[idx].genres = genres[idx];
    }

    let formattedTracks = await formatTracksForViz(tracks);

    return formattedTracks;
}

async function topArtists() {
    let timeRanges = ["short_term", "medium_term", "long_term"];
    let ret = {}
    for (let timeRange of timeRanges) {
        let artists = await callWithRetry(
            () => {return spotifyApi.getMyTopArtists({"limit": 50, "time_range": timeRange})}
        ).then(function(response) {
            response.body.artists = response.body.items;
            return response;
        }).then(unpackArtistsResponse);
        ret[timeRange] = artists;
    }
    return ret;
}

async function topTracks() {
    let timeRanges = ["short_term", "medium_term", "long_term"];
    let ret = {}
    for (let timeRange of timeRanges) {
        let tracks = await callWithRetry(
            () => {return spotifyApi.getMyTopTracks({"limit": 50, "time_range": timeRange})}
        ).then(
            function (response) {
                for (let i in response.body.items) {
                    newItem = {
                        "track": response.body.items[i],
                    }
                    response.body.items[i] = newItem;
                }

                console.log("Formatted top tracks: ", response.body.items);
                return response;
            }
        ).then(unpackTracksResponse);
        console.log("top tracks: ", tracks);
        let features = await featurizeTracks(tracks);
        console.log("features for top tracks: ", features);
        // Coalesce tracks and features
        for (let idx in tracks) {
            tracks[idx].audio_features = features[idx];
        }
        // Get artist genres for all tracks
        let genres = await genresForTracks(tracks);
        for (let idx in tracks) {
            tracks[idx].genres = genres[idx];
        }
        let formattedTracks = await formatTracksForViz(tracks);
        ret[timeRange] = formattedTracks;
    }
    return ret;
}

async function recentlyPlayed() {
    let tracks = await callWithRetry(
        () => {return spotifyApi.getMyRecentlyPlayedTracks({"limit": 50})}
    ).then(unpackTracksResponse);
    let features = await featurizeTracks(tracks);
    // Coalesce tracks and features
    for (let idx in tracks) {
        tracks[idx].audio_features = features[idx];
    }
    // Get artist genres for all tracks
    let genres = await genresForTracks(tracks);
    for (let idx in tracks) {
        tracks[idx].genres = genres[idx];
    }
    let formattedTracks = await formatTracksForViz(tracks);
    return formattedTracks;
}

async function profile() {
    return (await callWithRetry(() => {return spotifyApi.getMe()})).body;
}

async function libraryFeatures(offset, limit) {
    let tracksResults = callWithRetry(() => {
        return spotifyApi.getMySavedTracks({"offset": offset, "limit": limit});
    });
    let featuresResults = tracksResults.then(
        function (response) {
            let tracks = response.body.items;
            let ids = [];
            for (let i in tracks) {
                ids.push(tracks[i].track.id);
            }
            return callWithRetry(() => {
                return spotifyApi.getAudioFeaturesForTracks(ids).then(
                    function (r) {
                        let features = r.body.audio_features;
                        let ret = [];
                        for (let i in features) {
                            let track = tracks[i];
                            track.audio_features = features[i];
                            ret.push(track);
                        }
                        return ret;
                    }
                );
            });
        }
    );
    let genresResults = featuresResults.then(
        function (tracks) {
            let promises = [];
            let artistIds = [];
            for (let i in tracks) {
                let artists = tracks[i].track.artists;
                for (let j in artists) {
                    artistIds.push(artists[j].id);
                }
                // Call /v1/artists
                // promises.push(callWithRetry(() => {return spotifyApi.getArtists(artistIds)}));
            }
            let artistTotal = artistIds.length;
            let numCalls = parseInt(artistTotal / 50) + 1;
            promises = [];
            for (let i = 0; i < numCalls; i++) {
                let ids = artistIds.slice(i * 50, (i + 1) * 50);
                if (ids.length > 0) {
                    console.log("getting genres for" + ids.length + "artists");
                    promises.push(callWithRetry(() => {return spotifyApi.getArtists(ids)}));
                }
            }
            return Promise.all(promises).then(
                function (artistResponses) {
                    let artistIdx = 0;
                    let responseIdx = 0;
                    let ret = [];
                    for (let i in tracks) {
                        let trackArtists = tracks[i].track.artists;
                        // convert i and j to index in artistResponses
                        if (artistIdx >= 50) {
                            artistIdx %= 50;
                            responseIdx += 1
                        }
                        let response = artistResponses[responseIdx];
                        let artists = response.body.artists.slice(artistIdx, artistIdx + trackArtists.length);
                        let genres = [];
                        for (let j in artists) {
                            for (let k in artists[j].genres) {
                                genres.push(artists[j].genres[k]);
                            }
                        }
                        let track = tracks[i];
                        track.genres = genres;
                        ret.push(track);

                        artistIdx += artists.length;
                    }
                    return ret;
                }
            );
        }
    )
    return genresResults;
    return Promise.all([featuresResults, genresResults]).then(
        function(res) {
            let features = res[0];
            let genres = res[1];
            let ret = []
            for (let i in features) {
                ret.push(
                    {
                        "track": features.track,
                        "audio_feature": features.audio_feature,
                        "genres": genres.genres,
                    }
                );
            }
        }
    );
}

function loadPage() {
    setVizButtons();
    initApi();
    // put loading screen
    Promise.all([
        library(),
        topArtists(),
        topTracks(),
        recentlyPlayed(),
        profile()
    ]).then(
        function (data) {
            console.log("loaded all data");
            console.log("library:", data[0]);
            console.log("top artists:", data[1]);
            console.log("top tracks:", data[2]);
            console.log("recently played:", data[3]);
            console.log("profile:", data[4]);
            console.log(viz);
            viz.data.songDataGlobal = data[0];
            window.localStorage.setItem("library", pako.deflate(JSON.stringify(data[0])));
            // window.localStorage.setItem("libraryBig", JSON.stringify(data[0]));
            viz.data.topArtistsGlobal = data[1];
            viz.data.topTracksGlobal = data[2];
            viz.data.recentlyPlayedGlobal = data[3];
            viz.data.userProfileGlobal = data[4];
            viz.loadPage().then(
                () => {
                    document.getElementById("status").style = "display: none;";
                    document.getElementById("viz").style = "";
                }
            );
            // clear loading
        }, function (error) {
            console.log("error!");
            console.log(error);
            // show error
            document.getElementById("status").innerHTML = error.toString();
        }
    )
}

let urlQuery = window.location.search;
let urlParams = new URLSearchParams(urlQuery);

// Check cookies for auth information
let code_challenge = Cookies.get("code_challenge");
let code_verifier = Cookies.get("code_verifier");

let access_token = Cookies.get("access_token");
let refresh_token = Cookies.get("refresh_token");
let login_button = document.getElementById("login-button");
let home_button = document.getElementById("home-button");

// if (access_token || refresh_token) {
//     if (window.location.href == redirectUri) {
//         window.location.href = "/viz";
//     }
//     let login_button = document.getElementById("login-button");
//     login_button.innerHTML = "Log Out";
//     login_button.onclick = logout;

//     if (access_token) {
//         console.log("have access token: " + access_token);
//         loadPage();
//     } else if (refresh_token) {
//         console.log("need to refresh with: " + refresh_token);
//         auth().then(() => {
//             console.log("auth completed");
//             loadPage();
//         });
//     } 
// } else {
//     if (code_challenge && code_verifier) {
//         auth().then(() => {
//                 console.log("auth completed");
//                 // window.location.href = "/viz";
//             }
//         );
//     } else {
//         console.log("need to complete auth!");
//         // let login_button = document.getElementById("login-button");
//         // login_button.innerHTML = "Log In";
//         // login_button.onclick = auth;
//         auth().then(() => {
//                 console.log("auth completed");
//                 // window.location.href = "/viz";
//             }
//         );
//     }
// }

function setVizButtons() {
    home_button.onclick = () => {window.location.replace("/");};
    login_button.innerHTML = "Log Out";
    login_button.onclick = logout;
}

if (window.location.pathname == "/") {
    // 
    console.log("on home page");
} else if (window.location.pathname == "/viz") {
    if (access_token) {
        console.log("have access token: " + access_token);
        loadPage();
    } else if (refresh_token) {
        console.log("have refresh token: " + refresh_token);
        auth().then(() => {
            console.log("auth completed with refresh token");
            loadPage();
        });
    } else {
        console.log("need to complete the auth flow")
        auth().then(() => {
            console.log("completed auth flow");
            loadPage();
        });
    }
} else if (window.location.pathname == "/callback") {
    console.log("on callback page");
    auth().then(() => {
        console.log("auth from callback");
        console.log("redirecting to /viz");
        window.location.replace("/viz");
    });
}