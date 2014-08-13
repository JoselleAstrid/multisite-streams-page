// API references:
// https://github.com/justintv/Twitch-API/blob/master/README.md
// http://developers.hitbox.tv/
//
// The following Javascript module pattern is from:
// http://stackoverflow.com/a/1479341

var Main = (function() {
    
    // 2014-01-17 00:45:02
    var hitboxDateRegex = /^(\d\d\d\d)-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)$/;
    
    var defaultSettings = {
        'twitchEnabled': true,
        'hitboxEnabled': true,
        'hitboxUsername': '',
        'streamLimit': 25,
        'videoLimit': 10
    };
    
    var $hitboxStreams = null;
    var $streams = null;
    
    var twitchStreamDicts = null;
    var hitboxStreamDicts = null;
    var twitchVideoDicts = null;
    var hitboxVideoDicts = null;
    
    var settingsDict = null;
    var $settingsForm = null;
    
    var callback = null;
    
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
            
            // Don't need to request any special permission scopes,
            // just reading non-sensitive data.
            var scopes = "user_read";
            
            var authUrl =
                'https://api.twitch.tv/kraken/oauth2/authorize?response_type=token&client_id='
                + clientId
                + '&redirect_uri='
                + redirectUri;
                + '&scope='
                + scopes;
        
            // Redirect to the authentication URL.
            window.location = authUrl;
        
            return false;
        }
        
        // If we're here, we have a urlFragment, presumably the OAuth2 token.
        //
        // The fragment looks like "access_token=ab1cdef2ghi3jk4l".
        // Parse out the actual token from the fragment.
        var fragmentRegex = /^#access_token=([a-z0-9]+)$/;
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
    
    
    
    /* Cookie functions from:
    http://www.quirksmode.org/js/cookies.html */
    function createCookie(name,value,days) {
        if (days) {
            var date = new Date();
            date.setTime(date.getTime()+(days*24*60*60*1000));
            var expires = "; expires="+date.toGMTString();
        }
        else var expires = "";
        document.cookie = name+"="+value+expires+"; path=/";
    }
    function readCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for(var i=0;i < ca.length;i++) {
            var c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
    }
    
    /* Settings functions
    We'll format the settings cookie like:
    settingname1>value1|settingname2>value2|... */
    function getSettingFromForm(name) {
        var $inputElmt = $settingsForm.find('input[name="'+name+'"]');
        if ($inputElmt) {
            if ($inputElmt.attr('type') === 'checkbox') {
                return $inputElmt.prop('checked');
            }
            else {
                return $inputElmt.val();
            }
        }
        return null;
    }
    function setSettingInForm(name, value) {
        var $inputElmt = $settingsForm.find('input[name="'+name+'"]');
        if ($inputElmt) {
            if ($inputElmt.attr('type') === 'checkbox') {
                // This will handle strings of 'true' or 'false',
                // or boolean values.
                $inputElmt.prop('checked', (value === true || value === 'true'));
            }
            else {
                $inputElmt.val(value);
            }
            return true;
        }
        return false;
    }
    function settingsFromCookieToForm() {
        var settingsStr = readCookie('settings');
        if (settingsStr === null) {
            return false;
        }
        
        // Parse the cookie's settings into an associative array.
        var nameValuePairs = settingsStr.split('|');
        var settingsFromCookie = {};
        var i;
        for (i = 0; i < nameValuePairs.length; i++) {
            var pairElmts = nameValuePairs[i].split('>');
            var settingName = pairElmts[0];
            var settingValue = pairElmts[1];
            settingsFromCookie[settingName] = settingValue;
        }
        
        // Now go through each setting in the form. If the cookie covers it,
        // use the value from the cookie. If the cookie doesn't cover it
        // (probably a newly added setting since the user's last visit),
        // set the default value, AND update the cookie with that setting
        // as well.
        var $inputElmts = $settingsForm.find('input');
        var cookieNeedsUpdate = false;
        for (i = 0; i < $inputElmts.length; i++) {
            var $input = $($inputElmts[i]);
            var settingName = $input.attr('name');
            if (settingsFromCookie.hasOwnProperty(settingName)) {
                setSettingInForm(settingName, settingsFromCookie[settingName]);
            }
            else {
                setSettingInForm(settingName, defaultSettings[settingName]);
                cookieNeedsUpdate = true;
            }
        }
        if (cookieNeedsUpdate) {
            settingsFromFormToCookie();
        }
        
        return true;
    }
    function settingsFromFormToCookie() {
        var $inputElmts = $settingsForm.find('input');
        var i;
        var nameValuePairs = [];
        
        for (i = 0; i < $inputElmts.length; i++) {
            var $input = $($inputElmts[i]);
            var settingName = $input.attr('name');
            var settingValue = getSettingFromForm(settingName);
            nameValuePairs.push(settingName + '>' + settingValue);
        }
        
        var settingsStr = nameValuePairs.join('|');
        
        createCookie('settings', settingsStr, 365*10);
    }
    function initializeSettings() {
        // Fill the settings form with default values
        for (settingName in defaultSettings) {
            if (!defaultSettings.hasOwnProperty(settingName)) {continue;}
            setSettingInForm(settingName, defaultSettings[settingName]);
        }
    }
    function showSettings(saveCallback, cancelCallback) {
        
        var saveFunction = function(){
            settingsFromFormToCookie();
            saveCallback();
        }
        var cancelFunction = function(){
            // Revert any changes the user might've made
            settingsFromCookieToForm();
            cancelCallback();
        }
        
        $( "#settings-form" ).dialog({
            title: "Settings",
            modal: true,
            buttons: {
                Save: function() {
                    saveFunction();
                    $(this).dialog("close");
                },
                Cancel: function() {
                    cancelFunction();
                    $(this).dialog("close");
                }
            },
            width: 500
        });
    }
    function refreshPage() {
        window.location.reload();
    }
    
    
    
    /* Date/time utility functions */
    
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
    
    function dateObjToTimeAgo(dateObj) {
        // Code adapted from:
        // http://stackoverflow.com/a/12475270
        //
        // For more features (internationalization, auto refreshes),
        // possibly try http://timeago.yarp.com/ (uses MIT license)
        
        var time = dateObj.getTime();
        var currentTime = Date.now();
        
        var time_formats = [
            [60, 'seconds', 1], // 60
            [120, '1 minute ago', '1 minute from now'], // 60*2
            [3600, 'minutes', 60], // 60*60, 60
            [7200, '1 hour ago', '1 hour from now'], // 60*60*2
            [86400, 'hours', 3600], // 60*60*24, 60*60
            [172800, '1 day ago', '1 day from now'], // 60*60*24*2
            [604800, 'days', 86400], // 60*60*24*7, 60*60*24
            [1209600, '1 week ago', '1 week from now'], // 60*60*24*7*4*2
            [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
            [4838400, '1 month ago', '1 month from now'], // 60*60*24*7*4*2
            [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
            [58060800, '1 year ago', '1 year from now'], // 60*60*24*7*4*12*2
            [2903040000, 'years', 29030400] // 60*60*24*7*4*12*100, 60*60*24*7*4*12
        ];
        
        var seconds = (currentTime - time) / 1000;
        var token = 'ago';
        var format_choice = 1;
        
        if (seconds == 0) {
            return 'Just now'
        }
        if (seconds < 0) {
            seconds = Math.abs(seconds);
            token = 'from now';
            format_choice = 2;
        }
        
        var i, format;
        for (i = 0; i < time_formats.length; i++) {
            format = time_formats[i];
            
            if (seconds < format[0]) {
                if (typeof format[2] == 'string')
                    return format[format_choice];
                else  // number
                    return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
            }
        }
        return "At an unknown date";
    }
    
    function timeSecToHMS(totalSeconds) {
        var seconds = totalSeconds % 60;
        var totalMinutes = (totalSeconds-seconds)/60;
        var minutes = totalMinutes % 60;
        var hours = (totalMinutes-minutes)/60;
        
        var zfill = function(str, desiredLength){
            var outStr = str;
            while (outStr.length < desiredLength) {
                outStr = '0' + outStr;
            }
            return outStr;
        };
        
        var hoursStr = hours.toFixed();
        var minutesStr = minutes.toFixed();
        var minutesStrPadded = zfill(minutes.toFixed(), 2);
        var secondsStr = zfill(seconds.toFixed(), 2);
        
        if (hours === 0) {
            return (minutesStr + ":" + secondsStr);
        }
        else {
            return (hoursStr + ":" + minutesStrPadded + ":" + secondsStr);
        }
    }
    
    
    
    function showNotification(notificationText) {
        var $notificationArea = $('div#notifications');
        
        $notificationArea.text(notificationText);
        $notificationArea.show();
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
            + '?callback=Main.collectTwitchStreams'
            + '&oauth_token=' + twitchOAuth2Token
            + '&nocache=' + (new Date()).getTime()
            + '&limit=' + getSettingFromForm('streamLimit');
        document.getElementsByTagName("head")[0].appendChild(scriptElmt);
        
        scriptElmt = document.createElement("script");
        scriptElmt.src = 'https://api.twitch.tv/kraken/videos/followed'
            + '?callback=Main.collectTwitchVideos'
            + '&oauth_token=' + twitchOAuth2Token
            + '&nocache=' + (new Date()).getTime()
            + '&limit=' + getSettingFromForm('videoLimit');
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
            // How to test: Type garbage after "access_token=".
            showNotification(
                "Couldn't find your Twitch stream listing. "
                + "Try removing everything after the # in the URL, "
                + "and load the page again."
            );
            twitchStreamDicts = [];
            callback();
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
            streamDict.game = stream.channel.game || "Game not specified";
            streamDict.viewCount = stream.viewers;
            streamDict.channelName = stream.channel.display_name;
            streamDict.site = 'Twitch';
            
            twitchStreamDicts.push(streamDict);
        }
        
        callback();
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
            callback();
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
            videoDict.game = video.game || "Game not specified";
            videoDict.viewCount = video.views;
            videoDict.channelName = video.channel.display_name;
            videoDict.duration = timeSecToHMS(video.length);
            videoDict.site = 'Twitch';
            
            var dateObj = new Date(video.recorded_at);
            videoDict.unixTimestamp = dateObj.getTime();
            videoDict.dateDisplay = dateObjToTimeAgo(dateObj);
            
            twitchVideoDicts.push(videoDict);
        }
        
        callback();
    }
    
    
    
    function getHitboxUserId() {
            
        // Since the Hitbox API doesn't use OAuth, we just specify
        // the Hitbox username manually in the settings.
        var username = getSettingFromForm('hitboxUsername');
        
        if (username === '') {
            showNotification("No Hitbox username specified in the settings.");
            hitboxStreamDicts = [];
            hitboxVideoDicts = [];
            callback();
            return;
        }
        
        // Make an API call to get this Hitbox user's info.
        var url = 'https://www.hitbox.tv/api/media/live/' + username;
        
        // Use $.ajax() instead of $.getJSON() so that we can define a
        // callback to handle errors, including:
        // - The username doesn't exist
        // - The user hasn't set their stream title and game
        $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',
            success: getHitboxStreamsAndVideos,
            error: function() {
                showNotification(
                    "Couldn't get your Hitbox following listing. Two possible causes: "
                    + "(A) You need to set your Hitbox stream title and game, even if "
                    + "you don't plan to stream. Otherwise I can't find your user info, "
                    + "due to a quirk in how Hitbox accounts work. "
                    + "(B) The username you specified doesn't exist on Hitbox."
                );
                hitboxStreamDicts = [];
                hitboxVideoDicts = [];
                callback();
            }
        });
    }
    function getHitboxStreamsAndVideos(liveInfo) {
        
        var userId = liveInfo.livestream[0].media_user_id;
        
        
        // Make an API call to get the live streams that this user
        // is following.
        var url = 'https://www.hitbox.tv/api/media/live/list?'
            + 'follower_id=' + userId
            + '&limit=' + getSettingFromForm('streamLimit');
        
        // Use $.ajax() instead of $.getJSON() so that we can define a
        // callback to handle errors, including:
        // - no streams being live (that returns an error for some reason)
        $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',
            success: collectHitboxStreams,
            error: function() {hitboxStreamDicts = []; callback();}
        });
        
        
        // Make an API call to get the latest videos of the channels that
        // this user is following.
        // (Note: These are the parts of recordings that the user has chosen
        // to save. Basically like Twitch highlights.)
        var url = 'https://www.hitbox.tv/api/media/video/list?'
            + 'filter=recent&follower_id=' + userId
            + '&limit=' + getSettingFromForm('videoLimit');
        
        // Use $.ajax() instead of $.getJSON() so that we can define a
        // callback to handle errors, including:
        // - no videos from channels you follow
        $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',
            success: collectHitboxVideos,
            error: function() {hitboxVideoDicts = []; callback();}
        });
    }
    function collectHitboxStreams(liveList) {
        
        var livestreams = liveList.livestream;
        hitboxStreamDicts = [];
        
        var i;
        for (i = 0; i < livestreams.length; i++) {
            var stream = livestreams[i];
            var streamDict = {};
            
            streamDict.channelLink = stream.channel.channel_link;
            streamDict.thumbnailUrl = 'http://edge.vie.hitbox.tv' + stream.media_thumbnail;
            streamDict.title = stream.media_status;
            // TODO: Should this be stream.channel.category_name?
            // I wonder if one updates and one does not, when the
            // broadcaster changes it mid-stream.
            streamDict.game = stream.category_name || "Game not specified";
            streamDict.viewCount = stream.media_views;
            streamDict.channelName = stream.media_user_name;
            streamDict.site = 'Hitbox';
            
            hitboxStreamDicts.push(streamDict);
        }
        
        callback();
    }
    function collectHitboxVideos(videoList) {
        
        var videos = videoList.video;
        hitboxVideoDicts = [];
        
        var i;
        for (i = 0; i < videos.length; i++) {
            var video = videos[i];
            var videoDict = {};
            
            videoDict.videoLink = 'http://www.hitbox.tv/video/' + video.media_id;
            videoDict.thumbnailUrl = 'http://edge.vie.hitbox.tv' + video.media_thumbnail;
            videoDict.videoTitle = video.media_status;
            videoDict.description = video.media_description || "No description";
            videoDict.game = video.category_name || "Game not specified";
            videoDict.viewCount = video.media_views;
            videoDict.channelName = video.media_user_name;
            videoDict.duration = timeSecToHMS(video.media_duration);
            videoDict.site = 'Hitbox';
            
            var dateObj = hitboxDateStrToObj(video.media_date_added);
            videoDict.unixTimestamp = dateObj.getTime();
            
            // Can also use video.media_time_ago to get this directly as a
            // string, but Twitch doesn't have an equivalent field...
            //
            // So, we might as well use this same non-API function to calculate
            // time ago for both Twitch and Hitbox. It keeps things consistent.
            videoDict.dateDisplay = dateObjToTimeAgo(dateObj);
            
            hitboxVideoDicts.push(videoDict);
        }
        
        callback();
    }
    
    
    function listStreams($container, streamDicts) {
        
        // Sort by view count, decreasing order.
        streamDicts.sort( function(a, b) {
            return parseInt(b.viewCount) - parseInt(a.viewCount);
        });
        
        var i;
        for (i = 0; i < streamDicts.length; i++) {
            var streamDict = streamDicts[i];
            
            var $streamContainer = $('<a>');
            $streamContainer.attr('href', streamDict.channelLink);
            $streamContainer.attr('title', streamDict.title);
            
            var $thumbnailCtnr = $('<div>');
            $thumbnailCtnr.attr('class', 'thumbnail-ctnr');
            $streamContainer.append($thumbnailCtnr);
            if (streamDict.site === 'Twitch') {
                $thumbnailCtnr.addClass('twitch-stream');
            }
            
            var $streamThumbnail = $('<img>');
            $streamThumbnail.attr('src', streamDict.thumbnailUrl);
            $thumbnailCtnr.append($streamThumbnail);
            
            var $streamTitle = $('<div>');
            $streamTitle.text(streamDict.title);
            $streamTitle.attr('class', 'media-title');
            $streamContainer.append($streamTitle);
            
            var $streamGame = $('<div>');
            $streamGame.text(streamDict.game);
            $streamGame.attr('class', 'media-game');
            $streamContainer.append($streamGame);
            
            var $channelNameAndViews = $('<div>');
            $channelNameAndViews.text(streamDict.viewCount
                             + ' - ' + streamDict.channelName);
            $channelNameAndViews.attr('class', 'channel-name');
            $streamContainer.append($channelNameAndViews);
            
            var $siteIndicator = $('<span>');
            $siteIndicator.text("■");
            $siteIndicator.addClass('site-indicator');
            if (streamDict.site === 'Twitch') {
                $siteIndicator.addClass('twitch');
            }
            else {  // Hitbox
                $siteIndicator.addClass('hitbox');
            }
            $channelNameAndViews.append($siteIndicator);
            
            $container.append($streamContainer);
        }
    }
    
    
    function listVideos($container, videoDicts) {
        
        // Sort by date, latest to earliest.
        //
        // TODO: Check if Twitch and Hitbox "date added" timestamps
        // agree in timezones...
        videoDicts.sort( function(a, b) {
            // Unix timestamp = milliseconds since the epoch.
            // Higher number = later date.
            return parseInt(b.unixTimestamp) - parseInt(a.unixTimestamp);
        });
        
        var i;
        for (i = 0; i < videoDicts.length; i++) {
            var videoDict = videoDicts[i];
            
            var $videoContainer = $('<a>');
            $videoContainer.attr('href', videoDict.videoLink);
            $videoContainer.attr('title', videoDict.videoTitle);
            
            var $thumbnailCtnr = $('<div>');
            $thumbnailCtnr.attr('class', 'thumbnail-ctnr');
            $videoContainer.append($thumbnailCtnr);
            if (videoDict.site === 'Twitch') {
                $thumbnailCtnr.addClass('twitch-video');
            }
            
            var $thumbnail = $('<img>');
            $thumbnail.attr('src', videoDict.thumbnailUrl);
            $thumbnailCtnr.append($thumbnail);
            
            var $title = $('<div>');
            $title.text(videoDict.videoTitle);
            $title.attr('class', 'media-title');
            $videoContainer.append($title);
            
            var $description = $('<div>');
            $description.text(videoDict.description);
            $description.attr('class', 'media-description');
            $videoContainer.append($description);
            
            var $game = $('<div>');
            $game.text(videoDict.game);
            $game.attr('class', 'media-game');
            $videoContainer.append($game);
            
            var $channelNameAndDate = $('<div>');
            $channelNameAndDate.text(videoDict.channelName
                              + ' - ' + videoDict.dateDisplay);
            $channelNameAndDate.attr('class', 'channel-name');
            $videoContainer.append($channelNameAndDate);
            
            var $siteIndicator = $('<span>');
            $siteIndicator.text("■");
            $siteIndicator.addClass('site-indicator');
            if (videoDict.site === 'Twitch') {
                $siteIndicator.addClass('twitch');
            }
            else {  // Hitbox
                $siteIndicator.addClass('hitbox');
            }
            $channelNameAndDate.append($siteIndicator);
            
            var $viewCount = $('<div>');
            $viewCount.text(videoDict.viewCount);
            $viewCount.attr('class', 'video-view-count');
            $videoContainer.append($viewCount);
            
            var $duration = $('<div>');
            $duration.text(videoDict.duration);
            $duration.attr('class', 'video-duration');
            $videoContainer.append($duration);
            
            $container.append($videoContainer);
        }
    }
    
    
    function loadStreamsAndVideos() {
        
        $streams = $('#streams');
        $videos = $('#videos');
        
        callback = function() {
            // This callback will list all streams/videos upon completion of
            // the final stream/video API call.
            //
            // Since we don't know which call chain will finish last, call this
            // once for each finished call chain. Even in error cases.
            
            var haveTwitchMedia =
                twitchStreamDicts !== null && twitchVideoDicts !== null;
            var haveHitboxMedia =
                hitboxStreamDicts !== null && hitboxVideoDicts !== null;
            
            var twitchOK = !getSettingFromForm('twitchEnabled') || haveTwitchMedia;
            var hitboxOK = !getSettingFromForm('hitboxEnabled') || haveHitboxMedia;
            
            if (twitchOK && hitboxOK) {
                
                var streamDicts = [];
                var videoDicts = [];
                
                if (getSettingFromForm('twitchEnabled')) {
                    streamDicts = streamDicts.concat(twitchStreamDicts);
                    videoDicts = videoDicts.concat(twitchVideoDicts);
                }
                if (getSettingFromForm('hitboxEnabled')) {
                    streamDicts = streamDicts.concat(hitboxStreamDicts);
                    videoDicts = videoDicts.concat(hitboxVideoDicts);
                }
                
                listStreams($streams, streamDicts);
                listVideos($videos, videoDicts);
            }
        };
        
        // For each site, we have to make one or more API calls via Ajax.
        // The function we call here will start the chain of API calls for
        // that site. Once the calls are done, that site's streams/videos
        // variable should be filled, and then the callback will be called.
        if (getSettingFromForm('twitchEnabled')) {
            getTwitchStreamsAndVideos();
        }
        if (getSettingFromForm('hitboxEnabled')) {
            getHitboxUserId();
        }
    }
    
    
    
    // Public methods
    
    return {
        
        init: function() {
            
            $settingsForm = $('#settings-form');
            
            var hasCookie = settingsFromCookieToForm();
            
            if (hasCookie) {
                if (getSettingFromForm('twitchEnabled')) {
                    var twitchAuthTokenIsSet = setTwitchOAuth2Token();
                    if (twitchAuthTokenIsSet === false) {
                        // Don't do anything, we're redirecting so we can get
                        // the token.
                        return;
                    }
                }
                loadStreamsAndVideos();
            }
            else {
                // No settings cookie yet, need to initialize it
                initializeSettings();
                settingsFromFormToCookie();
                // Prompt the user to set settings for the first time
                showSettings(refreshPage, refreshPage);
            }
            
            // Initialize settings button.
            $('#settings-button').click(
                function() {
                    showSettings(refreshPage, function(){});
                }
            );
        },
        
        // JSONP callbacks must be public.
        collectTwitchStreams: function(response) {
            collectTwitchStreams(response);
        },
        collectTwitchVideos: function(response) {
            collectTwitchVideos(response);
        }
    }
})();
