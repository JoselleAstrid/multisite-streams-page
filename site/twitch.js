var Twitch = (function() {
    
    var twitchStreamDicts = null;
    var twitchVideoDicts = null;
    
    var twitchOAuth2Token = null;
    
    
    /*
    If the twitch OAuth2 token is available: set it, and return true.
    If it's not available: redirect to get it, and return false.
    */
    function setTwitchOAuth2Token() {
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
            // we're just reading non-sensitive data.
        
            // Redirect to the authentication URL.
            window.location = authUrl;
        
            return false;
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
            showNotification(
                "Couldn't find the Twitch authentication token. "
                + "Try removing everything after the # in the URL, "
                + "and load the page again."
            );
            return false;
        }
        
        // Access token successfully grabbed.
        twitchOAuth2Token = regexResult[1];
        return true;
    }
    
    /*
    Set Ajax headers for Twitch.
    At least that was the plan, but it seems that since JSONP is used for
    Twitch, this may not really be needed.
    */
    function setTwitchAjaxHeader(xhr) {
        // API version; must be v3 to get followed videos
        xhr.setRequestHeader('Accept', 'application/vnd.twitchtv.v3+json');
        // OAuth2
        xhr.setRequestHeader('Authorization', twitchOAuth2Token);
    }
    
    
    
    function getTwitchStreamsAndVideos() {
        
        // Apparently Twitch does not support CORS:
        // https://github.com/justintv/Twitch-API/issues/133
        
        // If CORS worked, we'd do something like this... (using $.ajax()
        // instead of $.getJSON to pass a header, which is needed to specify
        // the API version and for OAuth2)
        // http://stackoverflow.com/questions/3229823/
        //$.ajax({
        //    url: 'https://api.twitch.tv/kraken/streams/followed',
        //    type: 'GET',
        //    dataType: 'json',
        //    success: collectTwitchStreams,
        //    beforeSend: setTwitchAjaxHeader
        //});
        
        // But since we must use JSONP, we do this instead.
        var scriptElmt;
        
        scriptElmt = document.createElement("script");
        scriptElmt.src = 'https://api.twitch.tv/kraken/streams/followed'
            + '?callback=Twitch.collectTwitchStreams'
            + '&oauth_token=' + twitchOAuth2Token
            + '&nocache=' + (new Date()).getTime()
            + '&limit=' + Main.getSettingFromForm('streamLimit');
        document.getElementsByTagName("head")[0].appendChild(scriptElmt);
        
        scriptElmt = document.createElement("script");
        scriptElmt.src = 'https://api.twitch.tv/kraken/videos/followed'
            + '?callback=Twitch.collectTwitchVideos'
            + '&oauth_token=' + twitchOAuth2Token
            + '&nocache=' + (new Date()).getTime()
            + '&limit=' + Main.getSettingFromForm('videoLimit');
        document.getElementsByTagName("head")[0].appendChild(scriptElmt);
        
        // The JSONP callback functions must exist in the global scope at the
        // time the <script> tag is evaluated by the browser (i.e. once
        // the request has completed).
        // http://stackoverflow.com/a/3840118
    }
    function collectTwitchStreams(streamsResponse) {
        
        // Stream response examples:
        // https://github.com/justintv/Twitch-API/blob/master/v3_resources/streams.md
        
        var followedStreams = streamsResponse.streams;
        
        if (!followedStreams) {
            // How to test: Type garbage after "access_token=". Or load in
            // Firefox, then load in Chrome, then load in Firefox again with
            // the same access token.
            showNotification(
                "Couldn't find your Twitch stream listing. "
                + "Try removing everything after the # in the URL, "
                + "and load the page again."
            );
            twitchStreamDicts = [];
            Main.callback();
            return;
        }
        
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
        
        Main.callback();
    }
    function collectTwitchVideos(videosResponse) {
        
        // Video response examples:
        // https://github.com/justintv/Twitch-API/blob/master/v3_resources/videos.md
        
        var followedVideos = videosResponse.videos;
        
        if (!followedVideos) {
            // How to test: Type garbage after "access_token=".
            showNotification(
                "Couldn't find your Twitch video listing. "
                + "Try removing everything after the # in the URL, "
                + "and load the page again."
            );
            twitchVideoDicts = [];
            Main.callback();
            return;
        }
        
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
                videoDict.gameImage = "http://static-cdn.jtvnw.net/ttv-boxart/"
                    + video.game + "-138x190.jpg";
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
        
        Main.callback();
    }
    
    
    
    // Public methods
    
    return {
    
        firstAPICall: function() {
            getTwitchStreamsAndVideos();
        },
        getStreamDicts: function() {
            return twitchStreamDicts;
        },
        getVideoDicts: function() {
            return twitchVideoDicts;
        },
        setTwitchOAuth2Token: function() {
            setTwitchOAuth2Token();
        },
        
        // JSONP callbacks must be public in order to work.
        collectTwitchStreams: function(response) {
            collectTwitchStreams(response);
        },
        collectTwitchVideos: function(response) {
            collectTwitchVideos(response);
        }
    }
})();
