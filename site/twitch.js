var Twitch = (function() {
    
    var twitchStreamDicts = null;
    var twitchVideoDicts = null;
    var hostDicts = null;
    var gameDicts = null;
    
    var twitchOAuth2Token = null;
    
    var username = null;
    
    var errorIndicator = "There was an error previously";
    
    var signalDone = {};
    
    
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
    
    /*
    Set Ajax headers for Twitch.
    At least that was the plan, but it seems that since JSONP is used for
    Twitch, this may not really be needed.
    */
    function setAjaxHeader(xhr) {
        // API version; must be v3 to get followed videos
        xhr.setRequestHeader('Accept', 'application/vnd.twitchtv.v3+json');
        // OAuth2
        xhr.setRequestHeader('Authorization', twitchOAuth2Token);
    }
    
    
    
    function getUsername() {
        if (twitchOAuth2Token === errorIndicator) {
            setUsername(errorIndicator);
            return;
        }
        
        // Apparently Twitch does not support CORS:
        // https://github.com/justintv/Twitch-API/issues/133
        
        // If CORS worked, we'd do something like this... (using $.ajax()
        // instead of $.getJSON to pass a header, which is needed to specify
        // the API version and for OAuth2)
        // http://stackoverflow.com/questions/3229823/
        //$.ajax({
        //    url: 'https://api.twitch.tv/kraken',
        //    type: 'GET',
        //    dataType: 'json',
        //    success: setUsername,
        //    beforeSend: setAjaxHeader
        //});
        
        // But since we must use JSONP, we do this instead.
        
        var scriptElmt = document.createElement("script");
        scriptElmt.src = 'https://api.twitch.tv/kraken'
            + '?callback=Twitch.setUsername'
            + '&oauth_token=' + twitchOAuth2Token
            + '&nocache=' + (new Date()).getTime();
        document.getElementsByTagName("head")[0].appendChild(scriptElmt);
        
        // The JSONP callback functions must exist in the global scope at the
        // time the <script> tag is evaluated by the browser (i.e. once
        // the request has completed).
        // http://stackoverflow.com/a/3840118
    }
    
    function getStreams() {
        if (twitchOAuth2Token === errorIndicator) {
            setStreams(errorIndicator);
            return;
        }
        
        var scriptElmt = document.createElement("script");
        scriptElmt.src = 'https://api.twitch.tv/kraken/streams/followed'
            + '?callback=Twitch.setStreams'
            + '&oauth_token=' + twitchOAuth2Token
            + '&nocache=' + (new Date()).getTime()
            + '&limit=' + Settings.get('streamLimit');
        document.getElementsByTagName("head")[0].appendChild(scriptElmt);
    }
    
    function getVideos() {
        if (twitchOAuth2Token === errorIndicator) {
            setVideos(errorIndicator);
            return;
        }
        
        var scriptElmt = document.createElement("script");
        scriptElmt.src = 'https://api.twitch.tv/kraken/videos/followed'
            + '?callback=Twitch.setVideos'
            + '&oauth_token=' + twitchOAuth2Token
            + '&nocache=' + (new Date()).getTime()
            + '&limit=' + Settings.get('videoLimit');
        document.getElementsByTagName("head")[0].appendChild(scriptElmt);
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
        
        // Apparently, even if it's not an authenticated call,
        // it still needs to be done using JSONP.
        var url =
            'http://api.twitch.tv/api/users/'
            + username
            + '/followed/hosting';
        
        var scriptElmt = document.createElement("script");
        scriptElmt.src = url
            + '?callback=Twitch.setHosts'
            + '&nocache=' + (new Date()).getTime()
            + '&limit=40'
            // TODO: Make a setting for a host limit? If so, should it be
            // tied into the stream limit somehow?
            // (Twitch's default is 40)
            //+ '&limit=' + Settings.get('hostLimit');
        document.getElementsByTagName("head")[0].appendChild(scriptElmt);
    }
    
    function getGames() {
        if (username === errorIndicator) {
            setGames(errorIndicator);
            return;
        }
        
        // Apparently, even if it's not an authenticated call,
        // it still needs to be done using JSONP.
        var url =
            'http://api.twitch.tv/api/users/'
            + username
            + '/follows/games/live';
        
        var scriptElmt = document.createElement("script");
        scriptElmt.src = url
            + '?callback=Twitch.setGames'
            + '&nocache=' + (new Date()).getTime()
            // TODO: Make a setting for a game limit?
            // (Note: Twitch doesn't specify a game limit by default)
            //+ '&limit=' + Settings.get('gameLimit');
        document.getElementsByTagName("head")[0].appendChild(scriptElmt);
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
        
        twitchStreamDicts = [];
        
        var i;
        for (i = 0; i < followedStreams.length; i++) {
            
            var stream = followedStreams[i];
            
            var streamDict = {};
            
            streamDict.channelLink = stream.channel.url;
            streamDict.thumbnailUrl = stream.preview.medium;
            streamDict.title = stream.channel.status;
            
            if (stream.channel.game) {
                streamDict.gameName = stream.channel.game;
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
            streamDict.site = 'Twitch';
            
            twitchStreamDicts.push(streamDict);
        }
        
        signalDone.setStreams.resolve();
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
        
        twitchVideoDicts = [];
        
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
            
            var dateObj = new Date(video.recorded_at);
            videoDict.unixTimestamp = dateObj.getTime();
            videoDict.dateDisplay = Util.dateObjToTimeAgo(dateObj);
            
            twitchVideoDicts.push(videoDict);
        }
        
        signalDone.setVideos.resolve();
    }
    
    function setHosts(hostsResponse) {
        var followedHosts;
        
        if (hostsResponse === errorIndicator) {
            followedHosts = [];
        }
        else {
            followedHosts = hostsResponse.hosts;
        }
        
        hostDicts = [];
        
        var i;
        for (i = 0; i < followedHosts.length; i++) {
            
            var host = followedHosts[i];
            
            var hostDict = {};
            
            hostDict.hosterName = host.display_name;
            hostDict.streamerName = host.target.channel.display_name;
            hostDict.streamLink = 'http://www.twitch.tv/' + host.name;
            hostDict.streamThumbnailUrl = host.target.preview;
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
        
        signalDone.setHosts.resolve();
    }
    
    function setGames(gamesResponse) {
        var followedGames;
        
        if (gamesResponse === errorIndicator) {
            followedGames = [];
        }
        else {
            followedGames = gamesResponse.follows;
        }
        
        gameDicts = [];
        
        var i;
        for (i = 0; i < followedGames.length; i++) {
            
            var game = followedGames[i];
            
            var gameDict = {};
            
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
        
        signalDone.setGames.resolve();
    }
    
    
    
    function setRequirements() {
        
        signalDone.setStreams = $.Deferred();
        signalDone.setHosts = $.Deferred();
        signalDone.setGames = $.Deferred();
        signalDone.setVideos = $.Deferred();
        
        Main.addRequirement('showStreams', signalDone.setStreams);
        Main.addRequirement('showHosts', signalDone.setHosts);
        Main.addRequirement('showGames', signalDone.setGames);
        Main.addRequirement('showVideos', signalDone.setVideos);
    }
    
    
    
    // Public methods
    
    return {
    
        setOAuth2Token: function() {
            return setOAuth2Token();
        },
        setRequirements: function() {
            setRequirements();
        },
        startGettingMedia: function() {
            getStreams();
            getUsername();
            getVideos();
        },
        getGameDicts: function() {
            return gameDicts;
        },
        getHostDicts: function() {
            return hostDicts;
        },
        getStreamDicts: function() {
            return twitchStreamDicts;
        },
        getVideoDicts: function() {
            return twitchVideoDicts;
        },
        
        
        // JSONP callbacks must be public in order to work.
        setGames: function(response) {
            setGames(response);
        },
        setHosts: function(response) {
            setHosts(response);
        },
        setStreams: function(response) {
            setStreams(response);
        },
        setUsername: function(response) {
            setUsername(response);
        },
        setVideos: function(response) {
            setVideos(response);
        }
    }
})();
