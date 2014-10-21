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
    
    // Black large square. This is used instead of Black square to
    // achieve better vertical centering alongside other text.
    var siteIndicatorChar = '⬛';
    
    var $streams = null;
    
    var settingsDict = null;
    var $settingsForm = null;
    
    var funcs = {};
    var funcRequirements = {};
    
    
    
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
    
    
    function showStreams() {
                
        var streamDicts = [];
        
        if (getSettingFromForm('twitchEnabled')) {
            streamDicts = streamDicts.concat(Twitch.getStreamDicts());
        }
        if (getSettingFromForm('hitboxEnabled')) {
            streamDicts = streamDicts.concat(Hitbox.getStreamDicts());
        }
        
        // Sort by view count, decreasing order.
        streamDicts.sort( function(a, b) {
            return parseInt(b.viewCount) - parseInt(a.viewCount);
        });
        
        
        var $container = $('#streams');
        
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
            
            
            // var $channelNameAndViews = $('<div>');
            // $channelNameAndViews.text(streamDict.viewCount
            //                  + ' - ' + streamDict.channelName);
            // $channelNameAndViews.attr('class', 'channel-name');
            // $streamContainer.append($channelNameAndViews);
            
            // var $siteIndicator = $('<span>');
            // $siteIndicator.text(siteIndicatorChar);
            // $siteIndicator.addClass('site-indicator');
            // if (streamDict.site === 'Twitch') {
            //     $siteIndicator.addClass('twitch');
            // }
            // else {  // Hitbox
            //     $siteIndicator.addClass('hitbox');
            // }
            // $channelNameAndViews.append($siteIndicator);
            
            
            var $channelNameAndViews = $('<div>');
            
            var $textSpan1 = $('<span>');
            $textSpan1.text(streamDict.viewCount);
            $channelNameAndViews.append($textSpan1);
            
            var $siteIndicator = $('<span>');
            $siteIndicator.text(siteIndicatorChar);
            $siteIndicator.addClass('site-indicator');
            if (streamDict.site === 'Twitch') {
                $siteIndicator.addClass('twitch');
            }
            else {  // Hitbox
                $siteIndicator.addClass('hitbox');
            }
            $channelNameAndViews.append($siteIndicator);
            
            var $textSpan2 = $('<span>');
            $textSpan2.text(streamDict.channelName);
            $channelNameAndViews.append($textSpan2);
            
            $streamContainer.append($channelNameAndViews);
            
            
            $container.append($streamContainer);
        }
    }
    
    
    function showVideos() {
                
        var videoDicts = [];
        
        if (getSettingFromForm('twitchEnabled')) {
            videoDicts = videoDicts.concat(Twitch.getVideoDicts());
        }
        if (getSettingFromForm('hitboxEnabled')) {
            videoDicts = videoDicts.concat(Hitbox.getVideoDicts());
        }
        
        // Sort by date, latest to earliest.
        videoDicts.sort( function(a, b) {
            // Unix timestamp = milliseconds since the epoch.
            // Higher number = later date.
            return parseInt(b.unixTimestamp) - parseInt(a.unixTimestamp);
        });
        
        
        var $container = $('#videos');
        
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
            $videoContainer.append($title);
            
            var $description = $('<div>');
            $description.text(videoDict.description);
            $description.attr('class', 'minor-text');
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
            
            
            // var $channelNameAndDate = $('<div>');
            // $channelNameAndDate.text(videoDict.channelName
            //                   + ' - ' + videoDict.dateDisplay);
            // $channelNameAndDate.attr('class', 'channel-name');
            // $videoContainer.append($channelNameAndDate);
            
            // var $siteIndicator = $('<span>');
            // $siteIndicator.text(siteIndicatorChar);
            // $siteIndicator.addClass('site-indicator');
            // if (videoDict.site === 'Twitch') {
            //     $siteIndicator.addClass('twitch');
            // }
            // else {  // Hitbox
            //     $siteIndicator.addClass('hitbox');
            // }
            // $channelNameAndDate.append($siteIndicator);
            
            var $channelNameAndDate = $('<div>');
            
            var $textSpan1 = $('<span>');
            $textSpan1.text(videoDict.channelName);
            $channelNameAndDate.append($textSpan1);
            
            var $siteIndicator = $('<span>');
            $siteIndicator.text(siteIndicatorChar);
            $siteIndicator.addClass('site-indicator');
            if (videoDict.site === 'Twitch') {
                $siteIndicator.addClass('twitch');
            }
            else {  // Hitbox
                $siteIndicator.addClass('hitbox');
            }
            $channelNameAndDate.append($siteIndicator);
            
            var $textSpan2 = $('<span>');
            $textSpan2.text(videoDict.dateDisplay);
            $channelNameAndDate.append($textSpan2);
            
            $videoContainer.append($channelNameAndDate);
            
            
            $container.append($videoContainer);
        }
    }
    
    
    function showHosts() {
                
        var hostDicts = [];
        
        if (getSettingFromForm('twitchEnabled')) {
            hostDicts = hostDicts.concat(Twitch.getHostDicts());
        }
        
        // No manual sorting needed since it's only from
        // one site (Twitch).
        
        var $outerContainer = $('#hosts');
        
        var i;
        for (i = 0; i < hostDicts.length; i++) {
            var dict = hostDicts[i];
            
            var $container = $('<a>');
            $container.attr('href', dict.streamLink);
            $container.attr('title', dict.streamTitle);
            
            
            var $thumbnailCtnr = $('<div>');
            $thumbnailCtnr.attr('class', 'thumbnail-ctnr');
            $container.append($thumbnailCtnr);
            
            $thumbnailCtnr.addClass('twitch-stream');
            
            var $streamThumbnail = $('<img>');
            $streamThumbnail.attr('class', 'media-thumbnail');
            $streamThumbnail.attr('src', dict.streamThumbnailUrl);
            $thumbnailCtnr.append($streamThumbnail);
            
            
            var $hostingText = $('<div>');
            $hostingText.text(dict.hosterName + " hosting " + dict.streamerName);
            $container.append($hostingText);
            
            
            var $streamTitle = $('<div>');
            $streamTitle.text(dict.streamTitle);
            $streamTitle.attr('class', 'minor-text');
            $container.append($streamTitle);
            
            
            if (getSettingFromForm('gameDisplay') === 'boximage') {
                // Game as box image
                if (dict.gameName !== null) {
                    var $gameImageCtnr = $('<a>');
                    $gameImageCtnr.attr('href', dict.gameLink);
                    $thumbnailCtnr.append($gameImageCtnr);
                
                    var $gameImage = $('<img>');
                    $gameImage.attr('class', 'game-image');
                    $gameImage.attr('src', dict.gameImage);
                    $gameImage.attr('title', dict.gameName);
                    $gameImageCtnr.append($gameImage);
                }
            }
            else if (getSettingFromForm('gameDisplay') === 'name') {
                // Game as name text
                var $game = $('<div>');
                $game.attr('class', 'media-game');
                if (dict.gameName !== null) {
                    $game.text(dict.gameName);
                }
                else {
                    $game.text("No game selected");
                }
                $container.append($game);
            }
            // Else, game display is 'none'
            
            
            // var $channelNameAndViews = $('<div>');
            // $channelNameAndViews.text(streamDict.viewCount
            //                  + ' - ' + streamDict.channelName);
            // $channelNameAndViews.attr('class', 'channel-name');
            // $streamContainer.append($channelNameAndViews);
            
            // var $siteIndicator = $('<span>');
            // $siteIndicator.text(siteIndicatorChar);
            // $siteIndicator.addClass('site-indicator');
            // if (streamDict.site === 'Twitch') {
            //     $siteIndicator.addClass('twitch');
            // }
            // else {  // Hitbox
            //     $siteIndicator.addClass('hitbox');
            // }
            // $channelNameAndViews.append($siteIndicator);
            
            
            var $channelNameAndViews = $('<div>');
            
            var $textSpan1 = $('<span>');
            $textSpan1.text(dict.viewCount);
            $channelNameAndViews.append($textSpan1);
            
            var $siteIndicator = $('<span>');
            $siteIndicator.text(siteIndicatorChar);
            $siteIndicator.addClass('site-indicator');
            $siteIndicator.addClass('twitch');
            $channelNameAndViews.append($siteIndicator);
            
            var $textSpan2 = $('<span>');
            $textSpan2.text(dict.streamerName);
            $channelNameAndViews.append($textSpan2);
            
            $container.append($channelNameAndViews);
            
            
            $outerContainer.append($container);
        }
        
        if (hostDicts.length > 0) {
            $('#hosts-container').show();
        }
    }
    
    
    function showGames() {
        
        var gameDicts = [];
        
        if (getSettingFromForm('twitchEnabled')) {
            gameDicts = gameDicts.concat(Twitch.getGameDicts());
        }
        
        // No manual sorting needed since it's only from
        // one site (Twitch).
        
        var $container = $('#games');
        
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
            
            // var channelWord;
            // if (gameDict.channelCount === 1) {
            //     channelWord = "channel";
            // }
            // else {
            //     channelWord = "channels";
            // }
            // $viewAndChannelCount.text(
            //     gameDict.viewCount + " - "
            //     + gameDict.channelCount + " " + channelWord);
            
            // var $siteIndicator = $('<span>');
            // $siteIndicator.text(siteIndicatorChar);
            // $siteIndicator.addClass('site-indicator twitch');
            // $viewAndChannelCount.append($siteIndicator);
            
            var $textSpan1 = $('<span>');
            $textSpan1.text(gameDict.viewCount);
            $viewAndChannelCount.append($textSpan1);
            
            var $siteIndicator = $('<span>');
            $siteIndicator.text(siteIndicatorChar);
            $siteIndicator.addClass('site-indicator twitch');
            $viewAndChannelCount.append($siteIndicator);
            
            var $textSpan2 = $('<span>');
            var channelWord;
            if (gameDict.channelCount === 1) {
                channelWord = "channel";
            }
            else {
                channelWord = "channels";
            }
            $textSpan2.text(gameDict.channelCount + " " + channelWord);
            $viewAndChannelCount.append($textSpan2);
            
            $viewAndChannelCount.attr('class', 'channel-name');
            $gameContainer.append($viewAndChannelCount);
            
            
            $container.append($gameContainer);
        }
        
        if (gameDicts.length > 0) {
            $('#games-container').show();
        }
    }
    
    
    
    function setRequirements() {
        
        addFunc('Main.showStreams', showStreams);
        addFunc('Main.showHosts', showHosts);
        addFunc('Main.showGames', showGames);
        addFunc('Main.showVideos', showVideos);
        
        addRequirement('Main.showStreams', 'Main.showHosts');
        
        addRequirement('Main.showStreams', 'Main.showGames');
        addRequirement('Main.showHosts', 'Main.showGames');
        
        addRequirement('Main.showStreams', 'Main.showVideos');
        addRequirement('Main.showHosts', 'Main.showVideos');
        addRequirement('Main.showGames', 'Main.showVideos');
        
        
        if (getSettingFromForm('twitchEnabled')) {
            Twitch.setRequirements();
        }
        if (getSettingFromForm('hitboxEnabled')) {
            Hitbox.setRequirements();
        }
    }
    
    function startGettingMedia() {
        
        // For each site, we have to make one or more API calls via Ajax.
        // The function we call here will start the chain of API calls for
        // that site, to retrieve streams, videos, etc.
        if (getSettingFromForm('twitchEnabled')) {
            Twitch.startGettingMedia();
        }
        if (getSettingFromForm('hitboxEnabled')) {
            Hitbox.startGettingMedia();
        }
    }
    
    
    
    function removeFromArray(arr, value) {
        /* Remove all instances of value from the array arr. */
        for(var i = arr.length - 1; i >= 0; i--) {
            if(arr[i] === value) {
               arr.splice(i, 1);
            }
        }
    }
    
    function curry(orig_func) {
        /* Specify arguments of a function without actually calling
           that function yet.
           Source:
           http://benalman.com/news/2010/09/partial-application-in-javascript/ */
        var ap = Array.prototype,
            args = arguments;
    
        function fn() {
            ap.push.apply( fn.args, arguments );
    
            return fn.args.length < orig_func.length
                ? fn
                : orig_func.apply( this, fn.args );
        };
    
        return function() {
            fn.args = ap.slice.call( args, 1 );
            return fn.apply( this, arguments );
        };
    }
    
    function runAndCheckReq(func, requirementName, targetName) {
        /* Assumes the target function takes no arguments. */
        
        // Allow the requirement function to take arguments.
        var args = [];
        for (var i=3, len = arguments.length; i < len; ++i) {
            args.push(arguments[i]);
        };
        
        // Use apply to pass in arguments as a list.
        //
        // ("this" value of undefined should be the same as calling
        // func without an object - e.g. func(arg1, arg2, ...) )
        func.apply(undefined, args);
        
        // Cross off this function as a requirement for the target
        // function. If this is the last requirement, run the
        // target function.
        // Assumes the target function takes no arguments...
        removeFromArray(funcRequirements[targetName], requirementName);
        
        // Useful debugging message
        console.log(requirementName + " - " + targetName
                    + ' [' + funcRequirements[targetName].toString() + ']');
        
        if (funcRequirements[targetName].length === 0) {
            funcs[targetName]();
        }
    }
    
    
    
    function addFunc(name, func) {
        // TODO: Is it possible to avoid having funcs altogether,
        // and just replace the methods directly, e.g.
        // Twitch.setStreams = ... ?
        // This would eliminate the need to specify "Main.getFunc(...)"
        // for certain callbacks, which is a hassle to remember, and
        // really annoying to debug when forgotten.
        
        funcs[name] = func;
    }
    
    function getFunc(name) {
        return funcs[name];
    }
    
    function addRequirement(requirementName, targetName) {
        
        // Add to the function requirement dict.
        if (funcRequirements.hasOwnProperty(targetName) ) {
            funcRequirements[targetName].push(requirementName);
        }
        else {
            funcRequirements[targetName] = [requirementName];
        }
        
        // Have the requirement function trigger the target function.
        var func = funcs[requirementName];
        
        funcs[requirementName] = curry(
            runAndCheckReq, func, requirementName, targetName);
    }
    
    
    
    // Public methods
    
    return {
        
        init: function() {
            
            $settingsForm = $('#settings-form');
            
            var hasCookie = settingsFromCookieToForm();
            
            if (hasCookie) {
                if (getSettingFromForm('twitchEnabled')) {
                    var nowRedirecting = Twitch.setOAuth2Token();
                    
                    if (nowRedirecting) {
                        // Don't do anything else here, we're redirecting
                        // so we can get the token.
                        return;
                    }
                }
                setRequirements();
                startGettingMedia();
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
        
        addFunc: function(name, func) {
            addFunc(name, func);
        },
        addRequirement: function(requirementName, targetName) {
            addRequirement(requirementName, targetName);
        },
        dateObjToTimeAgo: function(dateObj) {
            return dateObjToTimeAgo(dateObj);
        },
        getFunc: function(name) {
            return getFunc(name);
        },
        getSettingFromForm: function(name) {
            return getSettingFromForm(name);
        },
        showNotification: function(notificationText) {
            showNotification(notificationText);
        },
        timeSecToHMS: function(totalSeconds) {
            return timeSecToHMS(totalSeconds);
        }
    }
})();
