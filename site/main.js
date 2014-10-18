// API references:
// https://github.com/justintv/Twitch-API/blob/master/README.md
// http://developers.hitbox.tv/
//
// The following Javascript module pattern is from:
// http://stackoverflow.com/a/1479341

var Main = (function() {
    
    var defaultSettings = {
        'twitchEnabled': true,
        'hitboxEnabled': true,
        'hitboxUsername': '',
        'gameDisplay': 'boximage',
        'streamLimit': 25,
        'videoLimit': 10,
        'hitboxThumbnailServer': 'vie'
    };
    
    var $streams = null;
    
    var settingsDict = null;
    var $settingsForm = null;
    
    var callback = null;
    
    
    
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
        var $fieldElmt = $settingsForm.find(
            'input[name="'+name+'"], select[name="'+name+'"]'
        );
        if ($fieldElmt) {
            if ($fieldElmt.attr('type') === 'checkbox') {
                return $fieldElmt.prop('checked');
            }
            else {
                // This works for select and input/type=text.
                return $fieldElmt.val();
            }
        }
        return null;
    }
    function setSettingInForm(name, value) {
        var $fieldElmt = $settingsForm.find(
            'input[name="'+name+'"], select[name="'+name+'"]'
        );
        if ($fieldElmt) {
            if ($fieldElmt.attr('type') === 'checkbox') {
                // This will handle strings of 'true' or 'false',
                // or boolean values.
                $fieldElmt.prop('checked', (value === true || value === 'true'));
            }
            else {
                // This works for select and input/type=text.
                $fieldElmt.val(value);
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
        var $fieldElmts = $settingsForm.find('input, select');
        var cookieNeedsUpdate = false;
        for (i = 0; i < $fieldElmts.length; i++) {
            var $field = $($fieldElmts[i]);
            var settingName = $field.attr('name');
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
        var $fieldElmts = $settingsForm.find('input, select');
        var i;
        var nameValuePairs = [];
        
        for (i = 0; i < $fieldElmts.length; i++) {
            var $field = $($fieldElmts[i]);
            var settingName = $field.attr('name');
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
            $streamThumbnail.attr('class', 'media-thumbnail');
            $streamThumbnail.attr('src', streamDict.thumbnailUrl);
            $thumbnailCtnr.append($streamThumbnail);
            
            
            var $streamTitle = $('<div>');
            $streamTitle.text(streamDict.title);
            $streamTitle.attr('class', 'media-title');
            $streamContainer.append($streamTitle);
            
            
            if (getSettingFromForm('gameDisplay') === 'boximage') {
                // Game as box image
                if (streamDict.gameName !== null) {
                    var $gameImageCtnr = $('<a>');
                    $gameImageCtnr.attr('href', streamDict.gameLink);
                    $thumbnailCtnr.append($gameImageCtnr);
                
                    var $gameImage = $('<img>');
                    $gameImage.attr('class', 'game-image');
                    $gameImage.attr('src', streamDict.gameImage);
                    $gameImage.attr('title', streamDict.gameName);
                    $gameImageCtnr.append($gameImage);
                }
            }
            else if (getSettingFromForm('gameDisplay') === 'name') {
                // Game as name text
                var $game = $('<div>');
                $game.attr('class', 'media-game');
                if (streamDict.gameName !== null) {
                    $game.text(streamDict.gameName);
                }
                else {
                    $game.text("No game selected");
                }
                $streamContainer.append($game);
            }
            // Else, game display is 'none'
            
            
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
            $thumbnail.attr('class', 'media-thumbnail');
            $thumbnail.attr('src', videoDict.thumbnailUrl);
            $thumbnailCtnr.append($thumbnail);
            
            var $viewCount = $('<div>');
            $viewCount.text(videoDict.viewCount);
            $viewCount.attr('class', 'video-view-count');
            $thumbnailCtnr.append($viewCount);
            
            var $duration = $('<div>');
            $duration.text(videoDict.duration);
            $duration.attr('class', 'video-duration');
            $thumbnailCtnr.append($duration);
            
            
            var $title = $('<div>');
            $title.text(videoDict.videoTitle);
            $title.attr('class', 'media-title');
            $videoContainer.append($title);
            
            var $description = $('<div>');
            $description.text(videoDict.description);
            $description.attr('class', 'media-description');
            $videoContainer.append($description);
            
            
            if (getSettingFromForm('gameDisplay') === 'boximage') {
                // Game as box image
                if (videoDict.gameName !== null) {
                    var $gameImageCtnr = $('<a>');
                    $gameImageCtnr.attr('href', videoDict.gameLink);
                    $thumbnailCtnr.append($gameImageCtnr);
                
                    var $gameImage = $('<img>');
                    $gameImage.attr('class', 'game-image');
                    $gameImage.attr('src', videoDict.gameImage);
                    $gameImage.attr('title', videoDict.gameName);
                    $gameImageCtnr.append($gameImage);
                }
            }
            else if (getSettingFromForm('gameDisplay') === 'name') {
                // Game as text
                var $game = $('<div>');
                $game.attr('class', 'media-game');
                if (videoDict.gameName !== null) {
                    $game.text(videoDict.gameName);
                }
                else {
                    $game.text("No game selected");
                }
                $videoContainer.append($game);
            }
            // Else, game display is 'none'
            
            
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
            
            $container.append($videoContainer);
        }
    }
    
    
    function listGames() {
        
        var $container = $('#games');
        var gameDicts = Twitch.getGameDicts();
        
        // No manual sorting needed since it's only from
        // one site (Twitch).
        
        var i;
        for (i = 0; i < gameDicts.length; i++) {
            var gameDict = gameDicts[i];
            
            var $gameContainer = $('<a>');
            $gameContainer.attr('href', gameDict.gameLink);
            $gameContainer.attr('title', gameDict.name);
            
            
            var $gameImage = $('<img>');
            $gameImage.attr('class', 'followed-game');
            $gameImage.attr('src', gameDict.gameImage);
            $gameContainer.append($gameImage);
            
            
            var $gameName = $('<div>');
            $gameName.text(gameDict.name);
            $gameContainer.append($gameName);
            
            
            var $viewAndChannelCount = $('<div>');
            // TODO: Singular if only 1 viewer or 1 channel
            // $viewAndChannelCount.text(
            //     gameDict.viewCount
            //     + " (" + gameDict.channelCount + " channels)");
            
            var $textSpan1 = $('<span>');
            $textSpan1.text(gameDict.viewCount);
            $viewAndChannelCount.append($textSpan1);
            
            var $siteIndicator = $('<span>');
            $siteIndicator.text("■");
            $siteIndicator.addClass('site-indicator twitch');
            $viewAndChannelCount.append($siteIndicator);
            
            var $textSpan2 = $('<span>');
            $textSpan2.text(gameDict.channelCount + " channels");
            $viewAndChannelCount.append($textSpan2);
            
            $viewAndChannelCount.attr('class', 'channel-name');
            $gameContainer.append($viewAndChannelCount);
            
            
            $container.append($gameContainer);
        }
        
        if (gameDicts.length > 0) {
            $('#games-container').show();
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
            
            var twitchStreamDicts = Twitch.getStreamDicts();
            var twitchVideoDicts = Twitch.getVideoDicts();
            var hitboxStreamDicts = Hitbox.getStreamDicts();
            var hitboxVideoDicts = Hitbox.getVideoDicts();
            
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
            Twitch.firstAPICall();
        }
        if (getSettingFromForm('hitboxEnabled')) {
            Hitbox.firstAPICall();
        }
    }
    
    
    
    // Public methods
    
    return {
        
        init: function() {
            
            $settingsForm = $('#settings-form');
            
            var hasCookie = settingsFromCookieToForm();
            
            if (hasCookie) {
                if (getSettingFromForm('twitchEnabled')) {
                    var twitchAuthTokenIsSet = Twitch.setTwitchOAuth2Token();
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
        
        callback: function() {
            callback();
        },
        dateObjToTimeAgo: function(dateObj) {
            return dateObjToTimeAgo(dateObj);
        },
        gamesCallback: function() {
            listGames();
        },
        getSettingFromForm: function(name) {
            return getSettingFromForm(name);
        },
        timeSecToHMS: function(totalSeconds) {
            return timeSecToHMS(totalSeconds);
        }
    }
})();
