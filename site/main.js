// API references:
// https://github.com/justintv/Twitch-API/blob/master/README.md
// http://developers.hitbox.tv/
//
// The following Javascript module pattern is from:
// http://stackoverflow.com/a/1479341

var Main = (function() {
    
    var $streams = null;
    
    var signalDone = {};
    var requireDone = {};
    
    
    function showNotification(notificationText) {
        var $notificationArea = $('div#notifications');
        
        $notificationArea.text(notificationText);
        $notificationArea.show();
    }
    
    
    function addGameDisplay(d, $container, $thumbnailCtnr) {
        /* Add a display indicating the game being played, for a
        stream, video, or host. */
            
        if (d.gameName === "Not supported on this site") {
            return;
        }
        
        if (Settings.get('gameDisplay') === 'boximage') {
            // Game as box image
            if (d.gameName !== null) {
                var $gameImageCtnr = $('<a>');
                $gameImageCtnr.attr('href', d.gameLink);
                $thumbnailCtnr.append($gameImageCtnr);
            
                var $gameImage = $('<img>');
                $gameImage.attr('class', 'game-image');
                $gameImage.attr('src', d.gameImage);
                $gameImage.attr('title', d.gameName);
                $gameImageCtnr.append($gameImage);
            }
        }
        else if (Settings.get('gameDisplay') === 'name') {
            // Game as name text
            var $game = $('<div>');
            $game.attr('class', 'media-game');
            if (d.gameName !== null) {
                $game.text(d.gameName);
            }
            else {
                $game.text("No game selected");
            }
            $container.append($game);
        }
        // Else, game display is 'none'
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
            var d = streamDicts[i];
            
            var $streamContainer = $('<a>');
            $streamContainer.attr('href', d.channelLink);
            $streamContainer.attr('title', d.title);
            
            
            var $thumbnailCtnr = $('<div>');
            $thumbnailCtnr.attr('class', 'thumbnail-ctnr');
            $streamContainer.append($thumbnailCtnr);
            if (d.site === 'Twitch') {
                $thumbnailCtnr.addClass('twitch-stream');
            }
            else if (d.site === 'Nico') {
                $thumbnailCtnr.addClass('nico-stream');
            }
            
            var $streamThumbnail = $('<img>');
            $streamThumbnail.attr('class', 'media-thumbnail');
            $streamThumbnail.attr('src', d.thumbnailUrl);
            $thumbnailCtnr.append($streamThumbnail);
            
            
            var $streamTitle = $('<div>');
            $streamTitle.text(d.title);
            $streamContainer.append($streamTitle);
            
            
            addGameDisplay(d, $streamContainer, $thumbnailCtnr);
            
            
            var $channelNameAndViews = $('<div>');
            
            var $textSpan1 = $('<span>');
            $textSpan1.text(d.viewCount);
            $channelNameAndViews.append($textSpan1);
            
            var $siteIndicator = $('<span>');
            $siteIndicator.addClass('site-indicator');
            if (d.site === 'Twitch') {
                $siteIndicator.addClass('twitch');
            }
            else if (d.site === 'Hitbox') {
                $siteIndicator.addClass('hitbox');
            }
            else {  // Nico
                $siteIndicator.addClass('nico');
            }
            $channelNameAndViews.append($siteIndicator);
            
            var $textSpan2 = $('<span>');
            $textSpan2.text(d.channelName);
            $channelNameAndViews.append($textSpan2);
            
            $streamContainer.append($channelNameAndViews);
            
            
            $container.append($streamContainer);
        }
        
        signalDone.showStreams.resolve();
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
            
            
            addGameDisplay(videoDict, $videoContainer, $thumbnailCtnr);
            
            
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
            
            
            addGameDisplay(dict, $container, $thumbnailCtnr);
            
            
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
        
        signalDone.showHosts.resolve();
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
        
        signalDone.showGames.resolve();
    }
    
    
    function addRequirement(targetName, deferredEvent) {
        /* This only applies to adding requirements for Main
        functions to run, since there would be issues with implementing
        targetName for any module (while keeping things simple).
        
        So, each individual site's module should just use
        requireDone[...].push(...) for its own internal requirements,
        instead of calling this. */
        requireDone[targetName].push(deferredEvent);
    }
    
    function setRequirements() {
        /* Define complicated function call requirements - e.g.
        "once events e1 and e2 complete, call function f". */
        
        requireDone.showStreams = [];
        requireDone.showHosts = [];
        requireDone.showGames = [];
        requireDone.showVideos = [];
        
        signalDone.showStreams = $.Deferred();
        signalDone.showHosts = $.Deferred();
        signalDone.showGames = $.Deferred();
        
        addRequirement('showHosts', signalDone.showStreams);
        
        addRequirement('showGames', signalDone.showStreams);
        addRequirement('showGames', signalDone.showHosts);
        
        addRequirement('showVideos', signalDone.showStreams);
        addRequirement('showVideos', signalDone.showHosts);
        addRequirement('showVideos', signalDone.showGames);
        
        // Call on each site's modules to add more requireDone items.
        if (Settings.get('twitchEnabled')) {
            Twitch.setRequirements();
        }
        if (Settings.get('hitboxEnabled')) {
            Hitbox.setRequirements();
        }
        if (Settings.get('nicoEnabled')) {
            Nico.setRequirements();
        }
        
        // $.when(e1, e2, ...).done(f) will set f to be called once all the
        // deferred events e1, e2, ... finish.
        //
        // Use apply() to pass an array as an argument list.
        $.when.apply(null, requireDone.showStreams).done(showStreams);
        $.when.apply(null, requireDone.showHosts).done(showHosts);
        $.when.apply(null, requireDone.showGames).done(showGames);
        $.when.apply(null, requireDone.showVideos).done(showVideos);
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
                Settings.show(Util.refreshPage, null);
            }
            
            // Initialize settings button.
            $('#settings-button').click(
                function() {
                    Settings.show(Util.refreshPage, function(){});
                }
            );
        },
        
        addRequirement: function(deferredEvent, targetName) {
            addRequirement(deferredEvent, targetName);
        },
        showNotification: function(notificationText) {
            showNotification(notificationText);
        }
    }
})();
