var Twitch = (function() {

    // Later we'll have Twitch be a proper class which accesses these as
    // this.accessToken, etc.
    // These describe the current user or their requested data.
    var thisAccessToken = null;
    var thisUserId = null;
    var thisFollowedUsers = null;
    // These are lookups containing more info on the requested data.
    var thisUsers = {};
    var thisGames = {};

    var TWITCH_STREAM_LIMIT = 100;
    var TWITCH_HOST_LIMIT = 100;
    var TWITCH_GAME_LIMIT = 100;


    /* Get the OAuth2 access token and return it. If we can't get the token
    without a redirect, return null. */
    async function auth() {
        // We already have the access token. Return it.
        if (thisAccessToken !== null) {return thisAccessToken;}

        //console.log(`Current URL: ${window.location}`);
        //console.log(`Fragment: ${window.location.hash}`);
        //console.log(`Search param string: ${window.location.search}`);

        // Two possibilities for parsing search params.
        // If auth is valid, then params will be in the hash (fragment) of the
        // URL, like: http://example.com/#access_token=123&id_token=456
        // In this case window.location.search will be an empty string, so we
        // use window.location.hash (which includes the #).
        // If we got an auth error, then params will NOT be in the hash, like:
        // http://example.com/?error=123&error_description=456
        // In this case window.location.hash will be an empty string, and
        // window.location.search will be usable.
        var currentSearchParams;
        if (window.location.hash) {
            var hash_without_pound_sign = window.location.hash.substring(1);
            currentSearchParams = new URLSearchParams(hash_without_pound_sign);
        }
        else {
            currentSearchParams = new URLSearchParams(window.location.search);
        }

        var authError = currentSearchParams.get('error');
        if (authError !== null) {
            // We just attempted OAuth, but it failed.
            if (authError === 'redirect_mismatch') {
                // We didn't use the exact URI that auth wanted.
                throw new Error(
                    "AuthError: There was a URL-related problem with Twitch"
                    + " authentication. Try loading the page again from a"
                    + " link or bookmark."
                );
            }
            else {
                var authErrorDescription =
                    currentSearchParams.get('error_description');
                throw new Error(
                    "AuthError: There was a problem with Twitch authentication."
                    + ` Details: "${authErrorDescription}"`
                );
            }
        }

        var accessToken = currentSearchParams.get('access_token');
        if (accessToken !== null) {
            // We just attempted OAuth, and it succeeded. Get and return
            // the token.
            // TODO: Maybe clean up the URL hash like before?
            thisAccessToken = accessToken;
            return thisAccessToken;
        }

        // If we're here, we don't have the access token yet, so get it.

        // https://dev.twitch.tv/docs/authentication/getting-tokens-oidc/#oidc-implicit-code-flow
        var requestSearchParams = new URLSearchParams();
        // Go to Twitch Settings -> Connections and create a new
        // dev app there. Enter this page's URI where it asks you to.
        // Then put the Client ID in config.js, whose contents may look
        // like this for example:
        // Config = {
        //     clientId: "abc1def2ghi3jkl4mno5pqr6stu7vw"
        // };
        requestSearchParams.set('client_id', Config.clientId);
        // Tell Twitch to redirect back to the current URL after auth.
        requestSearchParams.set('redirect_uri', window.location);
        // Request an access token and ID token.
        requestSearchParams.set('response_type', 'token id_token');
        // https://dev.twitch.tv/docs/authentication/#scopes
        // user_read is still needed for api v5's followed videos.
        requestSearchParams.set('scope', 'openid user_read');
        // TODO: Add nonce for CSRF defense
        // TODO: Add state for CSRF defense
        var authUrl =
            'https://id.twitch.tv/oauth2/authorize'
            + '?' + requestSearchParams.toString();

        // Redirect to the authentication URL.
        //console.log(`authUrl: ${authUrl}`);
        window.location = authUrl;
        return null;
    }

    // TODO: Check if needed
    function handleResponseError(response) {
        if (response.error === "Unauthorized") {
            // Authentication failed.
            //
            // How to test: Type garbage after "access_token=". Or load in
            // Firefox, then load in Chrome, then load in Firefox again with
            // the same access token.
            throw new Error(
                "There was a problem with Twitch authentication."
                + " Possible fixes:"
                + " (1) Try loading this page again. If there's a # at the"
                + " end of the URL, remove the # and hit Enter in the URL bar"
                + " to reload."
                + " (2) Go to twitch.tv, log out, log in again, and then try"
                + " loading this page again."
            );
        }
    }

    /* params is a URLSearchParams instance. We may have multiple
    params of the same key, and Twitch asks us to encode those in a specific
    way (bar=4&bar=5&bar=62); URLSearchParams adheres to that specific way. */
    async function ajaxRequest(url, params, beforeSend) {
        try {
            response = await $.ajax({
                url: url,
                type: 'GET',
                data: params.toString(),
                // processData is only to be used when passing data as JSON.
                // We're passing a query string.
                processData: false,
                beforeSend: beforeSend
            });
        }
        catch (e) {
            var message = `${url}:`
                + ` ${e.responseJSON.status} ${e.responseJSON.error}:`
                + ` ${e.responseJSON.message}`;
            throw new Error(message);
        }

        return response;
    }

    async function newApiRequest(relativeUrl, params) {
        var accessToken = await auth();
        params.set('oauth_token', accessToken);

        var setHeaders = function(xhr) {
            // https://dev.twitch.tv/docs/authentication/#sending-user-access-and-app-access-tokens
            xhr.setRequestHeader('Authorization', `Bearer ${thisAccessToken}`);
        }

        var response = await ajaxRequest(
            'https://api.twitch.tv/helix/' + relativeUrl,
            params, setHeaders);
        return response;
    }

    async function apiv5Request(relativeUrl, params) {
        var setHeaders = function(xhr) {
            // https://dev.twitch.tv/docs/authentication/#sending-user-access-and-app-access-tokens
            xhr.setRequestHeader('Authorization', `OAuth ${thisAccessToken}`);
            // https://dev.twitch.tv/docs/v5/#requests
            xhr.setRequestHeader('Accept', 'application/vnd.twitchtv.v5+json');
            xhr.setRequestHeader('Client-ID', Config.clientId);
        }

        var response = await ajaxRequest(
            'https://api.twitch.tv/kraken/' + relativeUrl,
            params, setHeaders);
        return response;
    }



    function dateStrToObj(s) {
        // The Twitch API gives dates as strings like: 2015-08-03T21:05:57Z
        // This is a "simplification of the ISO 8601 Extended Format"
        // which new Date() can take. The "Z" denotes UTC.
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
        // http://www.ecma-international.org/ecma-262/5.1/#sec-15.9.1.15
        return new Date(s);
    }



    /* Get current user's ID, if we haven't already. */
    async function getUserId() {
        if (thisUserId !== null) {return thisUserId;}

        var response = await newApiRequest('users', new URLSearchParams());
        thisUserId = response.data[0].id;
        return thisUserId;
    }

    /* Get the user's followed users, if we haven't already. */
    async function getFollowedUsers() {
        if (thisFollowedUsers !== null) {return thisFollowedUsers;}

        var userId = await getUserId();

        // https://dev.twitch.tv/docs/api/reference/#get-users-follows
        var params = new URLSearchParams();
        params.set('from_id', userId);
        params.set('first', 100);

        var response = await newApiRequest('users/follows', params);
        thisFollowedUsers = response.data;
        return thisFollowedUsers;
    }

    async function updateFollowedStreams() {
        var followedUsers = await getFollowedUsers();

        // https://dev.twitch.tv/docs/api/reference/#get-streams
        var params;
        params = new URLSearchParams();
        params.set('first', 100);
        followedUsers.forEach(function(followedUser) {
            params.append('user_id', followedUser.to_id);
        });
        var streamsResponse = await newApiRequest('streams', params);

        // Get users of these streams, because followedUsers doesn't include
        // display names.
        params = new URLSearchParams();
        params.set('first', 100);
        streamsResponse.data.forEach(function(stream) {
            if (!thisUsers.hasOwnProperty(stream.user_id)) {
                params.append('id', stream.user_id);
            }
        });
        if (params.get('id') !== null) {
            var usersResponse = await newApiRequest('users', params);
            usersResponse.data.forEach(function(user) {
                thisUsers[user.id] = user;
            });
        }

        // Get games of these streams.
        // TODO: Should be done in parallel with getting users.
        params = new URLSearchParams();
        params.set('first', 100);
        streamsResponse.data.forEach(function(stream) {
            if (!thisGames.hasOwnProperty(stream.game_id)) {
                params.append('id', stream.game_id);
            }
        });
        if (params.get('id') !== null) {
            var gamesResponse = await newApiRequest('games', params);
            gamesResponse.data.forEach(function(game) {
                thisGames[game.id] = game;
            });
        }

        // Actually set the streams.
        setFollowedStreams(streamsResponse.data);
    }

    async function updateVideos() {
        var followedUsers = await getFollowedUsers();

        // This is one query per followed user (brutally inefficient) in the
        // New Twitch API, and just one query total in the Twitch API v5:
        // https://dev.twitch.tv/docs/v5/reference/videos/#get-followed-videos
        // So we first use v5 to get the video IDs.
        var params;
        params = new URLSearchParams();
        params.set('limit', Settings.get('videoLimit'));
        params.set('broadcast_type', Settings.get('videoType'));
        var videosResponse1 = await apiv5Request('videos/followed', params);

        // Then, to be reasonably future-proof about video response formats,
        // we take these video IDs and feed them into the New Twitch API's
        // video endpoint to get full video details.
        params = new URLSearchParams();
        params.set('first', 100);
        videosResponse1.videos.forEach(function(video) {
            var id_with_v = video._id;
            var id_number_only = id_with_v.substring(1);
            params.append('id', id_number_only);
        });
        var videosResponse2 = await newApiRequest('videos', params);

        // Get users of these videos, because followedUsers doesn't include
        // display names.
        params = new URLSearchParams();
        params.set('first', 100);
        videosResponse2.data.forEach(function(video) {
            if (!thisUsers.hasOwnProperty(video.user_id)) {
                params.append('id', video.user_id);
            }
        });
        if (params.get('id') !== null) {
            var usersResponse = await newApiRequest('users', params);
            usersResponse.data.forEach(function(user) {
                thisUsers[user.id] = user;
            });
        }

        // Get games of these videos.
        // TODO: Should be done in parallel with getting users.
        params = new URLSearchParams();
        params.set('first', 100);
        videosResponse2.data.forEach(function(video) {
            if (!thisGames.hasOwnProperty(video.game_id)) {
                params.append('id', video.game_id);
            }
        });
        if (params.get('id') !== null) {
            var gamesResponse = await newApiRequest('games', params);
            gamesResponse.data.forEach(function(game) {
                thisGames[game.id] = game;
            });
        }

        // Actually set the videos.
        setVideos(videosResponse2.data);
    }



    function getHosts() {
        if (username === errorIndicator) {
            setHosts(errorIndicator);
            return;
        }

        var url =
            'https://api.twitch.tv/api/users/'
            + username
            + '/followed/hosting';

        ajaxRequest(url, {'limit': TWITCH_HOST_LIMIT}, setHosts);
    }

    function getGames() {
        if (username === errorIndicator) {
            setGames(errorIndicator);
            return;
        }

        var url =
            'https://api.twitch.tv/api/users/'
            + username
            + '/follows/games/live';

        ajaxRequest(url, {'limit': TWITCH_GAME_LIMIT}, setGames);
    }



    function setFollowedStreams(streamsData) {
        // Stream response examples:
        // https://dev.twitch.tv/docs/api/reference/#get-streams
        var twitchStreamDicts = [];

        streamsData.forEach(function(stream) {
            var streamDict = {};

            streamDict.channelLink =
                `https://www.twitch.tv/${stream.user_name}`;

            // Twitch seems to accept just about any width/height, but it'll be
            // stretched if it's not 16:9. 320x180 is what the Twitch following
            // page uses.
            streamDict.thumbnailUrl = stream.thumbnail_url
                .replace('{width}', 320)
                .replace('{height}', 180);

            streamDict.streamTitle = stream.title;

            if (stream.game_id) {
                var game = thisGames[stream.game_id];

                streamDict.gameName = game.name;
                streamDict.gameLink =
                    `https://www.twitch.tv/directory/game/${game.name}`;
                // Twitch seems to accept just about any width/height, but
                // it'll be stretched if it's not 16:9. 130x173 is what the
                // game directory page uses.
                streamDict.gameImage = game.box_art_url
                    .replace('{width}', 130)
                    .replace('{height}', 173);
            }
            else {
                streamDict.gameName = null;
            }

            streamDict.viewCount = stream.viewer_count;
            streamDict.channelName = thisUsers[stream.user_id].display_name;
            streamDict.startDate = dateStrToObj(stream.started_at);
            streamDict.site = 'Twitch';

            twitchStreamDicts.push(streamDict);
        });

        Main.addStreams(twitchStreamDicts);
    }

    function setVideos(videosData) {
        // Video response examples:
        // https://dev.twitch.tv/docs/api/reference/#get-videos
        //
        // TODO: Apparently the New Twitch API doesn't give games at all in the
        // videos endpoint. Oof. Might have to retreat back to v5 for
        // everything video related...

        var twitchVideoDicts = [];

        videosData.forEach(function(video) {
            var videoDict = {};

            videoDict.videoLink = video.url;
            videoDict.thumbnailUrl = video.thumbnail_url
                .replace('%{width}', 320)
                .replace('%{height}', 180);
            videoDict.videoTitle = video.title;
            videoDict.description = video.description || "No description";

            if (video.game_id) {
                var game = thisGames[video.game_id];

                videoDict.gameName = game.name;
                videoDict.gameLink =
                    `https://www.twitch.tv/directory/game/`
                    + `${game.name}/videos/week`;
                videoDict.gameImage = game.box_art_url
                    .replace('{width}', 130)
                    .replace('{height}', 173);
            }
            else {
                videoDict.gameName = null;
            }

            videoDict.viewCount = video.view_count;
            videoDict.channelName = thisUsers[video.user_id].display_name;
            videoDict.duration = video.duration;
            videoDict.site = 'Twitch';

            var dateObj = dateStrToObj(video.published_at);
            videoDict.unixTimestamp = dateObj.getTime();
            videoDict.dateDisplay = Util.dateObjToTimeAgo(dateObj);

            twitchVideoDicts.push(videoDict);
        });

        Main.addVideos(twitchVideoDicts);
    }

    function setHosts(hostsResponse) {
        var followedHosts;

        if (hostsResponse === errorIndicator) {
            followedHosts = [];
        }
        else {
            followedHosts = hostsResponse.hosts;
        }

        var hostDicts = [];

        var i;
        for (i = 0; i < followedHosts.length; i++) {

            var host = followedHosts[i];

            var hostDict = {};

            hostDict.site = 'Twitch';
            hostDict.hosterName = host.display_name;
            hostDict.streamerName = host.target.channel.display_name;
            hostDict.channelLink = 'http://www.twitch.tv/' + host.name;
            hostDict.thumbnailUrl = host.target.preview;
            hostDict.viewCount = host.target.viewers;
            hostDict.streamTitle = host.target.title;

            if (host.target.meta_game) {
                hostDict.gameName = host.target.meta_game;
                hostDict.gameLink = 'http://www.twitch.tv/directory/game/'
                    + host.target.meta_game
                // If the image doesn't exist then it'll give us
                // a "?" 404 boxart automatically.
                hostDict.gameImage = 'http://static-cdn.jtvnw.net/ttv-boxart/'
                    + host.target.meta_game + '-138x190.jpg';
            }
            else {
                hostDict.gameName = null;
            }

            hostDicts.push(hostDict);
        }

        Main.addHosts(hostDicts);
    }

    function setGames(gamesResponse) {
        var followedGames;

        if (gamesResponse === errorIndicator) {
            followedGames = [];
        }
        else {
            followedGames = gamesResponse.follows;
        }

        var gameDicts = [];

        var i;
        for (i = 0; i < followedGames.length; i++) {

            var game = followedGames[i];

            var gameDict = {};

            gameDict.site = 'Twitch';
            gameDict.name = game.game.name;
            gameDict.viewCount = game.viewers;
            gameDict.channelCount = game.channels;
            gameDict.gameLink = 'http://www.twitch.tv/directory/game/'
                    + game.game.name;
            // If the image doesn't exist then it'll give us
            // a "?" 404 boxart automatically.
            gameDict.gameImage = game.game.box.large;

            gameDicts.push(gameDict);
        }

        Main.addGames(gameDicts);
    }



    // Public methods

    return {
        siteName: 'Twitch',

        updateFollowedStreams: async function() {
            await updateFollowedStreams();
        },
        setHosts: function() {
            setHosts();
        },
        setGames: function() {
            setGames();
        },
        updateVideos: async function() {
            await updateVideos();
        }
    }
})();
