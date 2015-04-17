// API references:
// https://github.com/justintv/Twitch-API/blob/master/README.md
// http://developers.hitbox.tv/
//
// The following Javascript module pattern is from:
// http://stackoverflow.com/a/1479341

var Main = (function() {
    
    var $streams = null;
    
    var funcs = {};
    var funcRequirements = {};
    
    
    function showNotification(notificationText) {
        var $notificationArea = $('div#notifications');
        
        $notificationArea.text(notificationText);
        $notificationArea.show();
    }
    
    
    function showStreams() {
                
        var streamDicts = [];
        
        if (Settings.get('twitchEnabled')) {
            streamDicts = streamDicts.concat(Twitch.getStreamDicts());
        }
        if (Settings.get('hitboxEnabled')) {
            streamDicts = streamDicts.concat(Hitbox.getStreamDicts());
        }
        if (Settings.get('nicoEnabled')) {
            streamDicts = streamDicts.concat(Nico.getStreamDicts());
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
            else if (streamDict.site === 'Nico') {
                $thumbnailCtnr.addClass('nico-stream');
            }
            
            var $streamThumbnail = $('<img>');
            $streamThumbnail.attr('class', 'media-thumbnail');
            $streamThumbnail.attr('src', streamDict.thumbnailUrl);
            $thumbnailCtnr.append($streamThumbnail);
            
            
            var $streamTitle = $('<div>');
            $streamTitle.text(streamDict.title);
            $streamContainer.append($streamTitle);
            
            
            if (Settings.get('gameDisplay') === 'boximage') {
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
            else if (Settings.get('gameDisplay') === 'name') {
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
            
            var $textSpan1 = $('<span>');
            $textSpan1.text(streamDict.viewCount);
            $channelNameAndViews.append($textSpan1);
            
            var $siteIndicator = $('<span>');
            $siteIndicator.addClass('site-indicator');
            if (streamDict.site === 'Twitch') {
                $siteIndicator.addClass('twitch');
            }
            else if (streamDict.site === 'Hitbox') {
                $siteIndicator.addClass('hitbox');
            }
            else {  // Nico
                $siteIndicator.addClass('nico');
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
        
        if (Settings.get('twitchEnabled')) {
            videoDicts = videoDicts.concat(Twitch.getVideoDicts());
        }
        if (Settings.get('hitboxEnabled')) {
            videoDicts = videoDicts.concat(Hitbox.getVideoDicts());
        }
        if (Settings.get('nicoEnabled')) {
            videoDicts = videoDicts.concat(Nico.getVideoDicts());
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
            
            
            if (Settings.get('gameDisplay') === 'boximage') {
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
            else if (Settings.get('gameDisplay') === 'name') {
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
            
            var $textSpan1 = $('<span>');
            $textSpan1.text(videoDict.channelName);
            $channelNameAndDate.append($textSpan1);
            
            var $siteIndicator = $('<span>');
            $siteIndicator.addClass('site-indicator');
            if (videoDict.site === 'Twitch') {
                $siteIndicator.addClass('twitch');
            }
            else if (videoDict.site === 'Hitbox') {
                $siteIndicator.addClass('hitbox');
            }
            else {  // Nico
                $siteIndicator.addClass('nico');
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
        
        if (Settings.get('twitchEnabled')) {
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
            
            
            if (Settings.get('gameDisplay') === 'boximage') {
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
            else if (Settings.get('gameDisplay') === 'name') {
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
            
            
            var $channelNameAndViews = $('<div>');
            
            var $textSpan1 = $('<span>');
            $textSpan1.text(dict.viewCount);
            $channelNameAndViews.append($textSpan1);
            
            var $siteIndicator = $('<span>');
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
        
        if (Settings.get('twitchEnabled')) {
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
            
            var $textSpan1 = $('<span>');
            $textSpan1.text(gameDict.viewCount);
            $viewAndChannelCount.append($textSpan1);
            
            var $siteIndicator = $('<span>');
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
        
        
        if (Settings.get('twitchEnabled')) {
            Twitch.setRequirements();
        }
        if (Settings.get('hitboxEnabled')) {
            Hitbox.setRequirements();
        }
        if (Settings.get('nicoEnabled')) {
            Nico.setRequirements();
        }
    }
    
    function startGettingMedia() {
        
        // For each site, we have to make one or more API calls via Ajax.
        // The function we call here will start the chain of API calls for
        // that site, to retrieve streams, videos, etc.
        if (Settings.get('twitchEnabled')) {
            Twitch.startGettingMedia();
        }
        if (Settings.get('hitboxEnabled')) {
            Hitbox.startGettingMedia();
        }
        if (Settings.get('nicoEnabled')) {
            Nico.startGettingMedia();
        }
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
        Util.removeFromArray(funcRequirements[targetName], requirementName);
        
        // Useful debugging message
        //console.log(requirementName + " - " + targetName
        //            + ' [' + funcRequirements[targetName].toString() + ']');
        
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
        
        funcs[requirementName] = Util.curry(
            runAndCheckReq, func, requirementName, targetName);
    }
    
    
    
    // Public methods
    
    return {
        
        init: function() {
            
            if (Settings.hasStorage()) {
                Settings.storageToFields();
                
                if (Settings.get('twitchEnabled')) {
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
                // No settings stored yet. Initialize with defaults.
                Settings.fillFieldsWithDefaults();
                Settings.fieldsToStorage();
                // Prompt the user to set settings for the first time.
                Settings.show(Util.refreshPage, Util.refreshPage);
            }
            
            // Initialize settings button.
            $('#settings-button').click(
                function() {
                    Settings.show(Util.refreshPage, function(){});
                }
            );
        },
        
        addFunc: function(name, func) {
            addFunc(name, func);
        },
        addRequirement: function(requirementName, targetName) {
            addRequirement(requirementName, targetName);
        },
        getFunc: function(name) {
            return getFunc(name);
        },
        showNotification: function(notificationText) {
            showNotification(notificationText);
        }
    }
})();
