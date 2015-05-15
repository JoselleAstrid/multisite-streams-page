var Hitbox = (function() {
    
    // 2014-01-17 00:45:02
    var hitboxDateRegex = /^(\d\d\d\d)-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)$/;
    
    var userId = null;
    
    var errorIndicator = "There was an error previously";
    
    // Track server calls/requests.
    var numTotalRequests = 0;
    var numCompletedRequests = 0;
    
    // Limit doesn't actually seem to be 100 (it has been seen returning
    // 134 streams before), but it's a reasonable limit anyway.
    var HITBOX_STREAM_LIMIT = 100;
    
    
    
    function hitboxDateStrToObj(dateStr) {
        // From: API's date/time format, which is in UTC
        // To: Javascript Date obj, in local timezone
        
        var results = hitboxDateRegex.exec(dateStr);
        var year = results[1];
        var month = results[2] - 1;  // JS Dates start months from 0...
        var day = results[3];
        var hour = results[4];
        var minute = results[5];
        var second = results[6];
        
        var utcDate = new Date(year, month, day, hour, minute, second, 0);
        
        // getTimezoneOffset() returns the number of minutes that UTC
        // is ahead of your local time. So subtract that amount to go
        // from UTC to local.
        //
        // It doesn't matter what Date object you call getTimezoneOffset() from.
        var utcTimestamp = utcDate.getTime();
        var localTimestamp = utcTimestamp - (utcDate.getTimezoneOffset() * 60 * 1000);
        var localDate = new Date(localTimestamp);
        
        return localDate;
    }
    
    
    
    function incTotalRequests() {
        numTotalRequests++;
        Main.updateRequestStatus("Hitbox", numTotalRequests, numCompletedRequests);
    }
    function incCompletedRequests() {
        numCompletedRequests++;
        Main.updateRequestStatus("Hitbox", numTotalRequests, numCompletedRequests);
    }
    
    function requestsAreDone() {
        return numTotalRequests === numCompletedRequests;
    }
    
    
    
    function ajaxRequest(url, params, callback, errorCallback) {
        incTotalRequests();
        
        $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',
            data: params,
            success: Util.curry(
                function(callback_, response){
                    callback_(response);
                    incCompletedRequests();
                },
                callback
            ),
            error: Util.curry(
                function(callback_, response){
                    callback_(response);
                    incCompletedRequests();
                },
                errorCallback
            )
        });
    }
    
    
    
    function getUserId() {
            
        // Since the Hitbox API doesn't use OAuth, we just specify
        // the Hitbox username manually in the settings.
        var username = Settings.get('hitboxUsername');
        
        if (username === '') {
            Main.showNotification("No Hitbox username specified in the settings.");
            setUserId(errorIndicator);
            return;
        }
        
        // Make an API call to get this Hitbox user's info.
        var url = 'https://www.hitbox.tv/api/media/live/' + username;
        
        ajaxRequest(
            url, {},
            // Success callback
            setUserId,
            // Error callback
            function(response) {
                // Two known causes for an error here. Unfortunately, both
                // seem to give 404 errors, so we can't distinguish between
                // the two...
                Main.showNotification(
                    "Couldn't get your Hitbox following listing. Possible causes: "
                    + "(A) You need to set your Hitbox stream title and game, even if "
                    + "you don't plan to stream. Otherwise I can't find your user info, "
                    + "due to a quirk in how Hitbox accounts work. "
                    + "(B) The username you specified doesn't exist on Hitbox."
                );
                setUserId(errorIndicator);
            }
        );
    }
    
    function setUserId(liveInfo) {
        if (liveInfo === errorIndicator) {
            // Error occurred earlier.
            userId = errorIndicator;
            return;
        }
        
        userId = liveInfo.livestream[0].media_user_id;
        
        getStreams();
        getVideos();
    }
    
    
    function getStreams() {
        if (userId === errorIndicator) {
            // Error occurred earlier.
            setStreams(errorIndicator);
            return;
        }
        
        // Make an API call to get the live streams that this user
        // is following.
        var url = 'https://www.hitbox.tv/api/media/live/list';
        var params = {
            'follower_id': userId,
            'limit': HITBOX_STREAM_LIMIT
        };
        
        ajaxRequest(
            url, params,
            setStreams,
            function(response) { setStreams(errorIndicator); }
        );
    }
    
    function getVideos() {
        if (userId === errorIndicator) {
            // Error occurred earlier.
            setVideos(errorIndicator);
            return;
        }
        
        // Make an API call to get the latest videos of the channels that
        // this user is following.
        // (Note: These are the parts of recordings that the user has chosen
        // to save. Basically like Twitch highlights.)
        var url = 'https://www.hitbox.tv/api/media/video/list?';
        var params = {
            'filter': 'recent',
            'follower_id': userId,
            'limit': Settings.get('videoLimit')
        };
        
        ajaxRequest(
            url, params,
            setVideos,
            function(response) { setVideos(errorIndicator); }
        );
    }
    
    function setStreams(liveList) {
        var livestreams;
        
        if (liveList === errorIndicator) {
            // This is our case when the Hitbox streams response is an error.
            // This could either be an actual error or just no streams...
            // not knowing any better, we'll treat it as no streams.
            livestreams = [];
        }
        else {
            livestreams = liveList.livestream;
        }
        
        var hitboxStreamDicts = [];
        
        var i;
        for (i = 0; i < livestreams.length; i++) {
            var stream = livestreams[i];
            var streamDict = {};
            
            streamDict.channelLink = stream.channel.channel_link;
            streamDict.thumbnailUrl = 'http://edge.'
                + Settings.get('hitboxThumbnailServer')
                + '.hitbox.tv' + stream.media_thumbnail;
            streamDict.streamTitle = stream.media_status;
            
            if (stream.category_name) {
                streamDict.gameName = stream.category_name;
                streamDict.gameLink = 'http://www.hitbox.tv/game/' + stream.category_seo_key;
                streamDict.gameImage = 'http://edge.'
                    + Settings.get('hitboxThumbnailServer')
                    + '.hitbox.tv' + stream.category_logo_large;
            }
            else {
                streamDict.gameName = null;
            }
            
            streamDict.viewCount = stream.media_views;
            streamDict.channelName = stream.media_user_name;
            streamDict.site = 'Hitbox';
            
            hitboxStreamDicts.push(streamDict);
        }
        
        Main.addStreams(hitboxStreamDicts);
    }
    
    function setVideos(videoList) {
        var videos;
        
        if (videoList === errorIndicator) {
            // This is our case when the Hitbox videos response is an error.
            // This could either be an actual error or just no videos...
            // not knowing any better, we'll treat it as no videos.
            videos = [];
            return;
        }
        else {
            videos = videoList.video;
        }
        
        var hitboxVideoDicts = [];
        
        var i;
        for (i = 0; i < videos.length; i++) {
            var video = videos[i];
            var videoDict = {};
            
            videoDict.videoLink = 'http://www.hitbox.tv/video/' + video.media_id;
            videoDict.thumbnailUrl = 'http://edge.'
                + Settings.get('hitboxThumbnailServer')
                + '.hitbox.tv' + video.media_thumbnail;
            videoDict.videoTitle = video.media_status;
            videoDict.description = video.media_description || "No description";
            
            if (video.category_name) {
                videoDict.gameName = video.category_name;
                videoDict.gameLink = 'http://www.hitbox.tv/game/' + video.category_seo_key;
                videoDict.gameImage = 'http://edge.'
                    + Settings.get('hitboxThumbnailServer')
                    + '.hitbox.tv' + video.category_logo_large;
            }
            else {
                videoDict.gameName = null;
            }
            
            videoDict.viewCount = video.media_views;
            videoDict.channelName = video.media_user_name;
            videoDict.duration = Util.timeSecToHMS(video.media_duration);
            videoDict.site = 'Hitbox';
            
            var dateObj = hitboxDateStrToObj(video.media_date_added);
            videoDict.unixTimestamp = dateObj.getTime();
            
            // Can also use video.media_time_ago to get this directly as a
            // string, but Twitch doesn't have an equivalent field...
            //
            // So, we might as well use this same non-API function to calculate
            // time ago for both Twitch and Hitbox. It keeps things consistent.
            videoDict.dateDisplay = Util.dateObjToTimeAgo(dateObj);
            
            hitboxVideoDicts.push(videoDict);
        }
        
        Main.addVideos(hitboxVideoDicts);
    }
    
    
    
    // Public methods
    
    return {
        
        startGettingMedia: function() {
            getUserId();
        },
        requestsAreDone: function() {
            return requestsAreDone();
        }
    }
})();
