var Twitch = (function() {
    
    var twitchOAuth2Token = null;
    
    var username = null;
    
    var errorIndicator = "There was an error previously";
    
    // Track server calls/requests.
    var numTotalRequests = 0;
    var numCompletedRequests = 0;
    
    var TWITCH_STREAM_LIMIT = 100;
    var TWITCH_HOST_LIMIT = 100;
    var TWITCH_GAME_LIMIT = 100;
    
    
    function setOAuth2Token() {
        /*
        If the twitch OAuth2 token is available: set it.
        If it's not there yet: redirect to get it.
        If it's broken: set it to errorIndicator, and put up a notification.
        
        Return true if we're redirecting, false otherwise.
        */
        
        // The urlFragment, if any, should be the OAuth2 token.
        // If we don't have the token yet, then get it.
        var urlFragment = document.location.hash;
        
        if (urlFragment === "") {
            // Go to Twitch Settings -> Connections and create a new
            // dev app there. Enter this page's URI where it asks you to.
            // Then put the Client ID in config.js, whose contents may look
            // like this for example:
            // Config = {
            //     clientId: "abc1def2ghi3jkl4mno5pqr6stu7vw"
            // };
            var clientId = Config.clientId;
            
            var redirectUri = window.location;
            
            var authUrl =
                'https://api.twitch.tv/kraken/oauth2/authorize?response_type=token&client_id='
                + clientId
                + '&redirect_uri='
                + redirectUri;
            
            // If we needed special permission scopes, we'd add that as
            // '&scope=<scopes go here> at the end of the URL. But we
            // don't need to request any special permission scopes,
            // since we're only reading non-sensitive data.
            //
            // Dev note: When testing different scopes, be sure to remove the
            // auth token from the URL, so it actually re-authenticates.
        
            // Redirect to the authentication URL.
            window.location = authUrl;
        
            return true;
        }
        
        // If we're here, we have a urlFragment, presumably the OAuth2 token.
        //
        // The fragment looks like "access_token=ab1cdef2ghi3jk4l"
        // or "access_token=ab1cdef2ghi3jk4l&scope=".
        // Parse out the actual token from the fragment.
        var fragmentRegex = /^#access_token=([a-z0-9]+)/;
        var regexResult = fragmentRegex.exec(urlFragment);
        
        if (regexResult === null) {
            // URL fragment found, but couldn't parse an access token from it.
            //
            // How to test: Type garbage after the #.
            Main.showNotification(
                "Couldn't find the Twitch authentication token. "
                + "Try removing everything after the # in the URL, "
                + "and load the page again."
            );
            twitchOAuth2Token = errorIndicator;
            return false;
        }
        
        // Access token successfully grabbed.
        twitchOAuth2Token = regexResult[1];
        return false;
    }
    
    function onAuthFail() {
        Main.showNotification(
            "There was a problem with Twitch authentication. "
            + "Try removing everything after the # in the URL, "
            + "and load the page again."
        );
    }
    
    function onAuthSuccess() {
        // Remove the fragment from the URL, for two reasons:
        // 1. If the fragment is still there and the user refreshes the page,
        //    and the auth token has expired, then the auth will fail. This
        //    will probably confuse users - "why does the auth occasionally
        //    just fail?"
        // 2. It's kinda ugly, and potentially confusing for users
        //    when they see it.
        //
        // The drawback is that a page refresh with a still-valid auth token
        // will no longer be particularly fast, but that's arguably
        // outweighed by the above two things.
        //
        // As for how to remove the fragment, without triggering a refresh:
        // http://stackoverflow.com/a/13824103/
        
        // First check if we already removed the fragment from a previous call.
        // If so, we're done.
        if (window.location.href.indexOf('#') === -1) {
            return;
        }
        
        // Remove the fragment as much as it can go without adding an entry
        // in browser history.
        window.location.replace("#");
        
        // Slice off the remaining '#' in HTML5.
        if (typeof window.history.replaceState == 'function') {
            history.replaceState({}, '', window.location.href.slice(0, -1));
        }
    }
    
    
    
    function incTotalRequests() {
        numTotalRequests++;
        Main.updateRequestStatus(
            "Twitch", numTotalRequests, numCompletedRequests
        );
    }
    function incCompletedRequests() {
        numCompletedRequests++;
        Main.updateRequestStatus(
            "Twitch", numTotalRequests, numCompletedRequests
        );
    }
    
    function requestsAreDone() {
        return numTotalRequests === numCompletedRequests;
    }
    
    
    
    function setAjaxHeader(xhr) {
        // API version
        xhr.setRequestHeader('Accept', 'application/vnd.twitchtv.v3+json');
    }
    
    function ajaxRequest(url, params, callback) {
        incTotalRequests();
        
        var data = params;
        data.oauth_token = twitchOAuth2Token;
        
        // Apparently Twitch does not support CORS:
        // https://github.com/justintv/Twitch-API/issues/133
        // So we must use JSONP.
        $.ajax({
            url: url,
            type: 'GET',
            data: data,
            dataType: 'jsonp',
            success: Util.curry(
                function(callback_, response){
                    callback_(response);
                    incCompletedRequests();
                },
                callback
            ),
            beforeSend: setAjaxHeader
        });
    }
    
    
    
    function dateStrToObj(s) {
        // The Twitch API gives dates as strings like: 2015-08-03T21:05:57Z
        // This is a "simplification of the ISO 8601 Extended Format"
        // which new Date() can take. The "Z" denotes UTC.
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
        // http://www.ecma-international.org/ecma-262/5.1/#sec-15.9.1.15
        return new Date(s);
    }
    
    
    
    function getUsername() {
        if (twitchOAuth2Token === errorIndicator) {
            setUsername(errorIndicator);
            return;
        }
        
        // Apparently Twitch does not support CORS:
        // https://github.com/justintv/Twitch-API/issues/133
        // So we must use JSONP.
        ajaxRequest('https://api.twitch.tv/kraken', {}, setUsername);
    }
    
    function getStreams() {
        if (twitchOAuth2Token === errorIndicator) {
            setStreams(errorIndicator);
            return;
        }
        
        ajaxRequest(
            'https://api.twitch.tv/kraken/streams/followed',
            {'limit': TWITCH_STREAM_LIMIT},
            setStreams
        );
    }
    
    function getVideos() {
        if (twitchOAuth2Token === errorIndicator) {
            setVideos(errorIndicator);
            return;
        }
        
        ajaxRequest(
            'https://api.twitch.tv/kraken/videos/followed',
            {'limit': Settings.get('videoLimit')},
            setVideos
        );
    }
    
    
    
    function setUsername(userResponse) {
        if (userResponse === errorIndicator) {
            username = errorIndicator;
            return;
        }
        
        if (userResponse.token.valid === false) {
            // Authentication failed.
            //
            // How to test: Type garbage after "access_token=".
            onAuthFail();
            username = errorIndicator;
            return;
        }
        onAuthSuccess();
        
        username = userResponse.token.user_name;
        
        getHosts();
        getGames();
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
    
    
    
    function setStreams(streamsResponse) {
        var followedStreams;
        
        if (streamsResponse === errorIndicator) {
            followedStreams = [];
        }
        else if (streamsResponse.error && streamsResponse.error === "Unauthorized") {
            // Authentication failed.
            //
            // How to test: Type garbage after "access_token=". Or load in
            // Firefox, then load in Chrome, then load in Firefox again with
            // the same access token.
            onAuthFail();
            followedStreams = [];
        }
        else {
            onAuthSuccess();
            followedStreams = streamsResponse.streams;
        }
        
        // Stream response examples:
        // https://github.com/justintv/Twitch-API/blob/master/v3_resources/streams.md
        
        var twitchStreamDicts = [];
        
        var i;
        for (i = 0; i < followedStreams.length; i++) {
            
            var stream = followedStreams[i];
            
            var streamDict = {};
            
            // Three of the fields we use sometimes come up as blank in
            // Twitch's streams response:
            // channel.url, channel.game, and channel.status.
            // So we have backup values for each of those fields.
            
            streamDict.channelLink = stream.channel.url
              || 'http://www.twitch.tv/' + stream.channel.name;
              
            streamDict.thumbnailUrl = stream.preview.medium;
            
            streamDict.streamTitle = stream.channel.status
              || "(Failed to load title)";
            
            if (stream.channel.game || stream.game) {
                streamDict.gameName = stream.channel.game || stream.game;
                streamDict.gameLink = 'http://www.twitch.tv/directory/game/'
                    + stream.channel.game;
                // If the image doesn't exist then it'll give us
                // ttv-static/404_boxart-138x190.jpg automatically
                // (without us having to specify that).
                streamDict.gameImage = "http://static-cdn.jtvnw.net/ttv-boxart/"
                    + stream.channel.game + "-138x190.jpg";
            }
            else {
                streamDict.gameName = null;
            }
            
            streamDict.viewCount = stream.viewers;
            streamDict.channelName = stream.channel.display_name;
            streamDict.startDate = dateStrToObj(stream.created_at);
            streamDict.site = 'Twitch';
            
            twitchStreamDicts.push(streamDict);
        }
        
        Main.addStreams(twitchStreamDicts);
    }
    
    function setVideos(videosResponse) {
        var followedVideos;
        
        if (videosResponse === errorIndicator) {
            followedVideos = [];
        }
        else if (videosResponse.error && videosResponse.error === "Unauthorized") {
            // Authentication failed.
            //
            // How to test: Type garbage after "access_token=".
            onAuthFail();
            followedVideos = [];
        }
        else {
            onAuthSuccess();
            followedVideos = videosResponse.videos;
        }
        
        // Video response examples:
        // https://github.com/justintv/Twitch-API/blob/master/v3_resources/videos.md
        
        var twitchVideoDicts = [];
        
        var i;
        for (i = 0; i < followedVideos.length; i++) {
            
            var video = followedVideos[i];
            
            var videoDict = {};
            
            videoDict.videoLink = video.url;
            videoDict.thumbnailUrl = video.preview;
            videoDict.videoTitle = video.title;
            videoDict.description = video.description || "No description";
            
            if (video.game) {
                videoDict.gameName = video.game;
                videoDict.gameLink = 'http://www.twitch.tv/directory/game/'
                    + video.game + '/videos/week';
                // If the image doesn't exist then it'll give us
                // ttv-static/404_boxart-138x190.jpg automatically
                // (without us having to specify that).
                videoDict.gameImage = 'http://static-cdn.jtvnw.net/ttv-boxart/'
                    + video.game + '-138x190.jpg';
            }
            else {
                videoDict.gameName = null;
            }
                
            videoDict.viewCount = video.views;
            videoDict.channelName = video.channel.display_name;
            videoDict.duration = Util.timeSecToHMS(video.length);
            videoDict.site = 'Twitch';
            
            var dateObj = dateStrToObj(video.recorded_at);
            videoDict.unixTimestamp = dateObj.getTime();
            videoDict.dateDisplay = Util.dateObjToTimeAgo(dateObj);
            
            twitchVideoDicts.push(videoDict);
        }
        
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
    
        setOAuth2Token: function() {
            return setOAuth2Token();
        },
        startGettingMedia: function() {
            getStreams();
            getUsername();
            getVideos();
        },
        requestsAreDone: function() {
            return requestsAreDone();
        }
    }
})();
