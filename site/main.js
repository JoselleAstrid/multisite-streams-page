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
    var requestStatusE = null;
    
    
    function showNotification(notificationText) {
        var $notificationArea = $('div#notifications');
        
        $notificationArea.text(notificationText);
        $notificationArea.show();
    }
    
    function updateRequestStatus(
        siteName, numTotalRequests, numCompletedRequests) {
    
        // Look for an element of id request-status-<siteName>. This is the
        // element where we show this site's requests status.
        var statusId = 'request-status-' + siteName;
        var siteStatusE = document.getElementById(statusId);
        // If that element doesn't exist yet, then create it.
        if (!siteStatusE) {
            siteStatusE = document.createElement('span');
            siteStatusE.id = statusId;
            requestStatusE.appendChild(siteStatusE);
        }
    
        // Update the status.
        if (numTotalRequests === numCompletedRequests) {
            // All sent requests have completed
            siteStatusE.textContent = "";
            siteStatusE.style.display = 'none';
        }
        else {
            // Still some requests left to go
            siteStatusE.textContent = 
                siteName + ": " + numCompletedRequests.toString() + " of "
                + numTotalRequests.toString();
            siteStatusE.style.display = 'inline-block';
        }
        
        // Determine whether to hide the entire request status container.
        var allSitesDone = true;
        $(requestStatusE).find('span').each(
            function(index, e){if (e.textContent !== ""){allSitesDone = false;}}
        );
        if (allSitesDone) {
            requestStatusE.style.display = 'none';
        }
        else {
            requestStatusE.style.display = 'inline-block';
        }
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
    
    
    function addStreams(pendingStreams) {
        
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
    }
    
    
    function addHosts(pendingHosts) {
        
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
    }
    
    
    function addGames(pendingGames) {
        
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
    }
    
    
    function addVideos(pendingVideos) {
        
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
    
    
    
    function init() {
        
        requestStatusE = document.getElementById('request-status');
            
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
            startGettingMedia();
        }
        else {
            // No settings stored yet. Initialize with defaults.
            Settings.fillFieldsWithDefaults();
            Settings.fieldsToStorage();
            // Prompt the user to set settings for the first time.
            Settings.show(Util.refreshPage, null);
        }
        
        // Initialize help buttons.
        $('.help-button').each( function() {
            var buttonIdRegex = /^(.+)-button$/;
            var result = buttonIdRegex.exec(this.id);
            var helpTextId = result[1];
            
            // When this help button is clicked, open the corresponding
            // help text in a modal window.
            var clickCallback = function(helpTextId_, helpButtonE) {
                $('#'+helpTextId_).dialog({
                    modal: true,
                    width: 500,
                    position: {
                      my: "center bottom",
                      at: "right top",
                      of: helpButtonE
                    }
                });
            };
            $(this).click(
                Util.curry(clickCallback, helpTextId, this)
            );
        });
        
        // Initialize settings button.
        $('#settings-button').click(
            function() {
                Settings.show(Util.refreshPage, function(){});
            }
        );
    }
    
    
    
    // Public methods
    
    return {
        
        init: function() {
            init();
        },
        
        showNotification: function(notificationText) {
            showNotification(notificationText);
        },
        updateRequestStatus: function(site, numTotalRequests, numCompletedRequests) {
            updateRequestStatus(site, numTotalRequests, numCompletedRequests);
        },
        
        addStreams: function(streams) {
            addStreams(streams);
        },
        addHosts: function(hosts) {
            addHosts(hosts);
        },
        addGames: function(games) {
            addGames(games);
        },
        addVideos: function(videos) {
            addVideos(videos);
        }
    }
})();
