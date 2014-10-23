var Twitch = (function() {
    
    var twitchStreamDicts = null;
    var twitchVideoDicts = null;
    var hostDicts = null;
    var gameDicts = null;
    
    var twitchOAuth2Token = null;
    
    var username = null;
    
    var errorIndicator = "There was an error previously";
    
    
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
            Main.getFunc('Twitch.setUsername')(errorIndicator);
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
            Main.getFunc('Twitch.setStreams')(errorIndicator);
            return;
        }
        
        var scriptElmt = document.createElement("script");
        scriptElmt.src = 'https://api.twitch.tv/kraken/streams/followed'
            + '?callback=Twitch.setStreams'
            + '&oauth_token=' + twitchOAuth2Token
            + '&nocache=' + (new Date()).getTime()
            + '&limit=' + Main.getSettingFromForm('streamLimit');
        document.getElementsByTagName("head")[0].appendChild(scriptElmt);
    }
    
    function getVideos() {
        if (twitchOAuth2Token === errorIndicator) {
            Main.getFunc('Twitch.setVideos')(errorIndicator);
            return;
        }
        
        var scriptElmt = document.createElement("script");
        scriptElmt.src = 'https://api.twitch.tv/kraken/videos/followed'
            + '?callback=Twitch.setVideos'
            + '&oauth_token=' + twitchOAuth2Token
            + '&nocache=' + (new Date()).getTime()
            + '&limit=' + Main.getSettingFromForm('videoLimit');
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
            Main.showNotification(
                "There was a problem with Twitch authentication. "
                + "Try removing everything after the # in the URL, "
                + "and load the page again."
            );
            username = errorIndicator;
            return;
        }
        
        username = userResponse.token.user_name;
    }
    
    function getHosts() {
        if (username === errorIndicator) {
            Main.getFunc('Twitch.setHosts')(errorIndicator);
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
            //+ '&limit=' + Main.getSettingFromForm('hostLimit');
        document.getElementsByTagName("head")[0].appendChild(scriptElmt);
    }
    
    function getGames() {
        if (username === errorIndicator) {
            Main.getFunc('Twitch.setGames')(errorIndicator);
            return;
        }
        
        // Apparently, even if it's not an authenticated call,
        // it still needs to be done using JSONP.
        var url =
            'http://api.twitch.tv/api/users/'
            + username
            + '/follows/games';
        
        var scriptElmt = document.createElement("script");
        scriptElmt.src = url
            + '?callback=Twitch.setGames'
            + '&nocache=' + (new Date()).getTime()
            // TODO: Make a setting for a game limit?
            // (Note: Twitch doesn't specify a game limit by default)
            //+ '&limit=' + Main.getSettingFromForm('gameLimit');
        document.getElementsByTagName("head")[0].appendChild(scriptElmt);
    }
    
    
    
    function setStreams(streamsResponse) {
        if (streamsResponse === errorIndicator) {
            twitchStreamDicts = [];
            return;
        }
        
        if (streamsResponse.error && streamsResponse.error === "Unauthorized") {
            // Authentication failed.
            //
            // How to test: Type garbage after "access_token=". Or load in
            // Firefox, then load in Chrome, then load in Firefox again with
            // the same access token.
            Main.showNotification(
                "There was a problem with Twitch authentication. "
                + "Try removing everything after the # in the URL, "
                + "and load the page again."
            );
            twitchStreamDicts = [];
            return;
        }
        
        // Stream response examples:
        // https://github.com/justintv/Twitch-API/blob/master/v3_resources/streams.md
        
        var followedStreams = streamsResponse.streams;
        
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
    }
    function setVideos(videosResponse) {
        if (videosResponse === errorIndicator) {
            twitchVideoDicts = [];
            return;
        }
        
        if (videosResponse.error && videosResponse.error === "Unauthorized") {
            // Authentication failed.
            //
            // How to test: Type garbage after "access_token=".
            Main.showNotification(
                "There was a problem with Twitch authentication. "
                + "Try removing everything after the # in the URL, "
                + "and load the page again."
            );
            twitchVideoDicts = [];
            return;
        }
        
        // Video response examples:
        // https://github.com/justintv/Twitch-API/blob/master/v3_resources/videos.md
        
        var followedVideos = videosResponse.videos;
        
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
            videoDict.duration = Main.timeSecToHMS(video.length);
            videoDict.site = 'Twitch';
            
            var dateObj = new Date(video.recorded_at);
            videoDict.unixTimestamp = dateObj.getTime();
            videoDict.dateDisplay = Main.dateObjToTimeAgo(dateObj);
            
            twitchVideoDicts.push(videoDict);
        }
    }
    
    function setHosts(hostsResponse) {
        if (hostsResponse === errorIndicator) {
            hostDicts = [];
            return;
        }
        
        var followedHosts = hostsResponse.hosts;
        
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
    }
    
    function setGames(gamesResponse) {
        if (gamesResponse === errorIndicator) {
            gameDicts = [];
            return;
        }
        
        var followedGames = gamesResponse.follows;
        
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
    }
    
    
    
    function setRequirements() {
        
        Main.addFunc('Twitch.setUsername', setUsername);
        Main.addFunc('Twitch.setStreams', setStreams);
        Main.addFunc('Twitch.getHosts', getHosts);
        Main.addFunc('Twitch.setHosts', setHosts);
        Main.addFunc('Twitch.getGames', getGames);
        Main.addFunc('Twitch.setGames', setGames);
        Main.addFunc('Twitch.setVideos', setVideos);
        
        Main.addRequirement('Twitch.setStreams', 'Main.showStreams');
        
        Main.addRequirement('Twitch.setUsername', 'Twitch.getHosts');
        Main.addRequirement('Twitch.setHosts', 'Main.showHosts');
        
        Main.addRequirement('Twitch.setUsername', 'Twitch.getGames');
        Main.addRequirement('Twitch.setGames', 'Main.showGames');
        
        Main.addRequirement('Twitch.setVideos', 'Main.showVideos');
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
            Main.getFunc('Twitch.setGames')(response);
        },
        setHosts: function(response) {
            Main.getFunc('Twitch.setHosts')(response);
        },
        setStreams: function(response) {
            Main.getFunc('Twitch.setStreams')(response);
        },
        setUsername: function(response) {
            Main.getFunc('Twitch.setUsername')(response);
        },
        setVideos: function(response) {
            Main.getFunc('Twitch.setVideos')(response);
        }
    }
})();
