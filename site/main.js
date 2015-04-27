// API references:
// https://github.com/justintv/Twitch-API/blob/master/README.md
// http://developers.hitbox.tv/
//
// The following Javascript module pattern is from:
// http://stackoverflow.com/a/1479341

var Main = (function() {
    
    var streamDicts = [];
    var videoDicts = [];
    var $streamElements = [];
    var $hostElements = [];
    var $gameElements = [];
    var $videoElements = [];
    var pendingStreams = [];
    var pendingHosts = [];
    var pendingGames = [];
    var pendingVideos = [];
    
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
        
        var $container = $('#streams');
        // Do sorting by view count, highest first.
        var compareFunc = function(a, b) {
            return parseInt(b.viewCount) - parseInt(a.viewCount);
        };
        
        
        pendingStreams.forEach(function(d) {
                
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
            
            var $thumbnail = $('<img>');
            $thumbnail.attr('class', 'media-thumbnail');
            $thumbnail.attr('src', d.thumbnailUrl);
            $thumbnailCtnr.append($thumbnail);
            
            
            var $title = $('<div>');
            $title.text(d.title);
            $streamContainer.append($title);
            
            
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
            
            
            var index = Util.sortedLocation(d, streamDicts, compareFunc);
            // Add stream element to the page in sorted order
            if (index >= 0) {
                $streamContainer.insertAfter($streamElements[index]);
            }
            else {
                // index is -1, indicating that this goes at the beginning
                $container.prepend($streamContainer);
            }
            // Add to sorted list of stream dicts, which we maintain so we
            // can find the sorted order of each element
            streamDicts.splice(index + 1, 0, d);
            // Add to sorted list of stream elements, which we maintain so we
            // can refer to these for insertAfter()
            $streamElements.splice(index + 1, 0, $streamContainer);
        });
        
        pendingStreams = [];
    }
    
    
    function showHosts() {
        
        var $outerContainer = $('#hosts');
        
        
        pendingHosts.forEach(function(d) {
            
            var $container = $('<a>');
            $container.attr('href', d.streamLink);
            $container.attr('title', d.streamTitle);
            
            
            var $thumbnailCtnr = $('<div>');
            $thumbnailCtnr.attr('class', 'thumbnail-ctnr');
            $container.append($thumbnailCtnr);
            
            $thumbnailCtnr.addClass('twitch-stream');
            
            var $thumbnail = $('<img>');
            $thumbnail.attr('class', 'media-thumbnail');
            $thumbnail.attr('src', d.streamThumbnailUrl);
            $thumbnailCtnr.append($thumbnail);
            
            
            var $hostingText = $('<div>');
            $hostingText.text(d.hosterName + " hosting " + d.streamerName);
            $container.append($hostingText);
            
            
            var $title = $('<div>');
            $title.text(d.streamTitle);
            $title.attr('class', 'minor-text');
            $container.append($title);
            
            
            addGameDisplay(d, $container, $thumbnailCtnr);
            
            
            var $channelNameAndViews = $('<div>');
            
            var $textSpan1 = $('<span>');
            $textSpan1.text(d.viewCount);
            $channelNameAndViews.append($textSpan1);
            
            var $siteIndicator = $('<span>');
            $siteIndicator.addClass('site-indicator');
            $siteIndicator.addClass('twitch');
            $channelNameAndViews.append($siteIndicator);
            
            var $textSpan2 = $('<span>');
            $textSpan2.text(d.streamerName);
            $channelNameAndViews.append($textSpan2);
            
            $container.append($channelNameAndViews);
            
            
            // No sort algorithm needed since it's only from
            // one site (Twitch).
            $outerContainer.append($container);
            $hostElements.push($container);
        });
        
        if ($hostElements.length > 0) {
            $('#hosts-container').show();
        }
        
        pendingHosts = [];
    }
    
    
    function showGames() {
        
        var $container = $('#games');
        
        
        pendingGames.forEach(function(d) {
            
            var $gameContainer = $('<a>');
            $gameContainer.attr('href', d.gameLink);
            $gameContainer.attr('title', d.name);
            
            
            var $gameImage = $('<img>');
            $gameImage.attr('class', 'followed-game');
            $gameImage.attr('src', d.gameImage);
            $gameContainer.append($gameImage);
            
            
            var $gameName = $('<div>');
            $gameName.text(d.name);
            $gameContainer.append($gameName);
            
            
            var $viewAndChannelCount = $('<div>');
            
            var $textSpan1 = $('<span>');
            $textSpan1.text(d.viewCount);
            $viewAndChannelCount.append($textSpan1);
            
            var $siteIndicator = $('<span>');
            $siteIndicator.addClass('site-indicator twitch');
            $viewAndChannelCount.append($siteIndicator);
            
            var $textSpan2 = $('<span>');
            var channelWord;
            if (d.channelCount === 1) {
                channelWord = "channel";
            }
            else {
                channelWord = "channels";
            }
            $textSpan2.text(d.channelCount + " " + channelWord);
            $viewAndChannelCount.append($textSpan2);
            
            $viewAndChannelCount.attr('class', 'channel-name');
            $gameContainer.append($viewAndChannelCount);
            
            
            // No sort algorithm needed since it's only from
            // one site (Twitch).
            $container.append($gameContainer);
            $gameElements.push($gameContainer);
        });
        
        if ($gameElements.length > 0) {
            $('#games-container').show();
        }
        
        pendingGames = [];
    }
    
    
    function showVideos() {
        
        var $container = $('#videos');
        // Do sorting by date, latest to earliest.
        var compareFunc = function(a, b) {
            return parseInt(b.unixTimestamp) - parseInt(a.unixTimestamp);
        };
        
        
        pendingVideos.forEach(function(d) {
            
            var $videoContainer = $('<a>');
            $videoContainer.attr('href', d.videoLink);
            $videoContainer.attr('title', d.videoTitle);
            
            
            var $thumbnailCtnr = $('<div>');
            $thumbnailCtnr.attr('class', 'thumbnail-ctnr');
            $videoContainer.append($thumbnailCtnr);
            if (d.site === 'Twitch') {
                $thumbnailCtnr.addClass('twitch-video');
            }
            
            var $thumbnail = $('<img>');
            $thumbnail.attr('class', 'media-thumbnail');
            $thumbnail.attr('src', d.thumbnailUrl);
            $thumbnailCtnr.append($thumbnail);
            
            var $viewCount = $('<div>');
            $viewCount.text(d.viewCount);
            $viewCount.attr('class', 'video-view-count');
            $thumbnailCtnr.append($viewCount);
            
            var $duration = $('<div>');
            $duration.text(d.duration);
            $duration.attr('class', 'video-duration');
            $thumbnailCtnr.append($duration);
            
            
            var $title = $('<div>');
            $title.text(d.videoTitle);
            $videoContainer.append($title);
            
            var $description = $('<div>');
            $description.text(d.description);
            $description.attr('class', 'minor-text');
            $videoContainer.append($description);
            
            
            addGameDisplay(d, $videoContainer, $thumbnailCtnr);
            
            
            var $channelNameAndDate = $('<div>');
            
            var $textSpan1 = $('<span>');
            $textSpan1.text(d.channelName);
            $channelNameAndDate.append($textSpan1);
            
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
            $channelNameAndDate.append($siteIndicator);
            
            var $textSpan2 = $('<span>');
            $textSpan2.text(d.dateDisplay);
            $channelNameAndDate.append($textSpan2);
            
            $videoContainer.append($channelNameAndDate);
            
            
            var index = Util.sortedLocation(d, videoDicts, compareFunc);
            // Add element to the page in sorted order
            if (index >= 0) {
                $videoContainer.insertAfter($videoElements[index]);
            }
            else {
                // index is -1, indicating that this goes at the beginning
                $container.prepend($videoContainer);
            }
            videoDicts.splice(index + 1, 0, d);
            $videoElements.splice(index + 1, 0, $videoContainer);
        });
        
        pendingVideos = [];
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
        
        if (Settings.get('displayTiming') === 'asTheyArrive') {
            // Call the show functions each time media arrives.
            //
            // $.when(e).done(f) will set up function f to be called once
            // the event e finishes.
            requireDone.showStreams.forEach(function(x){
                $.when(x).done(showStreams);
            });
            requireDone.showHosts.forEach(function(x){
                $.when(x).done(showHosts);
            });
            requireDone.showGames.forEach(function(x){
                $.when(x).done(showGames);
            });
            requireDone.showVideos.forEach(function(x){
                $.when(x).done(showVideos);
            });
        }
        else {  // 'whenAllSitesComplete'
            // Call the show functions only when all the media of a
            // particular type has arrived.
            //
            // $.when(e1, e2, ...).done(f) will set up function f to be called
            // once all the deferred events e1, e2, ... finish. Use apply()
            // to pass an array as an argument list.
            $.when.apply(null, requireDone.showStreams).done(showStreams);
            $.when.apply(null, requireDone.showHosts).done(showHosts);
            $.when.apply(null, requireDone.showGames).done(showGames);
            $.when.apply(null, requireDone.showVideos).done(showVideos);
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
        },
        
        addStreams: function(streams) {
            streams.forEach(function(x){ pendingStreams.push(x); });
        },
        addHosts: function(hosts) {
            hosts.forEach(function(x){ pendingHosts.push(x); });
        },
        addGames: function(games) {
            games.forEach(function(x){ pendingGames.push(x); });
        },
        addVideos: function(videos) {
            videos.forEach(function(x){ pendingVideos.push(x); });
        }
    }
})();
