var Nico = (function() {
    
    var streamDicts = null;
    var videoDicts = null;
    
    var $coTableContainer = null;
    var $coEditArea = null;
    var $coEditButton = null;
    var $coConfirmArea = null;
    var $coConfirmButton = null;
    
    var coRegex = /^co[0-9]+$/;
    
    var errorIndicator = "There was an error previously";
    
    // Max number of streams we can get in a single API call.
    // For search.solr, http://www59.atwiki.jp/nicoapi/pages/48.html says
    // the max is 149, but it's actually 100.
    var MAX_STREAMS_IN_CALL = 100;
    // Max number of times we'll try a particular API call before giving up.
    var MAX_CALL_ATTEMPTS = 3;
    // Proxy request server: hardcoded for now. May be a config thing later
    // if we stick with this proxy-request plan.
    var PROXY_REQUEST_SERVER = 'http://127.0.0.1:8080/';
    
    // Max number of API calls to have active in parallel. Too few and it may
    // take too long for everything to finish. Too many and some calls might
    // time out since they waited too long (since Nico seems to throttle
    // multiple calls to some extent).
    var MAX_ACTIVE_CALLS = 6;
    var numActiveCalls = 0;
    var callQueue = [];
    
    // Stream search tag: hardcoded for now. May make this a setting or auto-
    // generated later.
    //var searchTag = "rta";
    var searchTag = "ゲーム";
    
    var allLiveStreams = null;
    var liveStreamsCallsExpected = null;
    var liveStreamsCallsCompleted = null;
    var numFailedCalls = 0;
    
    
    function proxyAjax(url, callback, attemptNum) {
        
        if (numActiveCalls >= MAX_ACTIVE_CALLS) {
            callQueue.push(Util.curry(proxyAjax, url, callback, attemptNum));
            return;
        }
        
        var options = {
            type: 'GET',
            dataType: 'json',
            url: PROXY_REQUEST_SERVER + url,
            success: Util.curry(
                function(callback_, response){
                    numActiveCalls--;
                    if (callQueue.length > 0) {
                        var waitingAjaxCall = callQueue.shift();
                        waitingAjaxCall();
                    }
                    
                    callback_(response);
                },
                callback
            ),
            error: Util.curry(
                function(url_, callback_, attemptNum_, response){
                    numActiveCalls--;
                    if (callQueue.length > 0) {
                        var waitingAjaxCall = callQueue.shift();
                        waitingAjaxCall();
                    }
                    
                    // Try again if we haven't reached the max attempts.
                    if (attemptNum_ < MAX_CALL_ATTEMPTS) {
                        proxyAjax(url_, callback_, attemptNum_+1);
                    }
                    else {
                        callback(errorIndicator);
                    }
                },
                url, callback, attemptNum
            )
        };
        $.ajax(options);
        
        numActiveCalls++;
    }
    
    
    function startGettingAllLiveStreams(attemptNum) {
        
        // Make an API call to get the first 'page' of all live streams.
        
        var url =
            'http://api.ce.nicovideo.jp/liveapi/v1/video.search.solr'
            + '?__format=json'
            + '&word=' + searchTag
            + '&limit=' + MAX_STREAMS_IN_CALL.toString();
        
        // To call Nico's API without getting a Cross Origin error, use CORS
        // via proxy.
        proxyAjax(url, Main.getFunc('Nico.finishGettingAllLiveStreams'), 1);
    }
    
    function finishGettingAllLiveStreams(response) {
        
        allLiveStreams = [];
        
        if (response === errorIndicator) {
            Main.showNotification(
                "Initial Nicovideo request didn't work after "
                + MAX_CALL_ATTEMPTS.toString()
                + " tries; giving up.");
            Main.getFunc('Nico.setStreams')();
            return;
        }
        
        var nlvResponse = response.nicolive_video_response;
        var totalCount = parseInt(nlvResponse.total_count.filtered);
        liveStreamsCallsExpected = 1;
        
        if (totalCount <= MAX_STREAMS_IN_CALL) {
            // Oh, we've already retrieved all the live streams.
            // Skip to the next step then.
            addToAllLiveStreams(response);
            return;
        }
        
        // So far we've made one call and obtained the total stream count.
        // Build the rest of the calls, using the total count to know when
        // to stop.
        //
        // (Note: currentIndex isn't the same as the number of streams
        // so far. For some reason the API may not give any streams at
        // indices 0 to 2.)
        var currentIndex = MAX_STREAMS_IN_CALL;
        var urls = [];
        
        while (currentIndex < totalCount) {
            urls.push(
                'http://api.ce.nicovideo.jp/liveapi/v1/video.search.solr'
                + '?__format=json'
                + '&word=' + searchTag
                + '&from=' + currentIndex.toString()
                + '&limit=' + MAX_STREAMS_IN_CALL.toString()
            );
            
            currentIndex += MAX_STREAMS_IN_CALL;
            liveStreamsCallsExpected++;
        }
        
        // Add the streams obtained from our first call.
        addToAllLiveStreams(response);
        
        $.each(urls, function(i, url){
            proxyAjax(url, Main.getFunc('Nico.addToAllLiveStreams'), 1);
        });
    }
    
    function addToAllLiveStreams(response) {
        
        if (response === errorIndicator) {
            numFailedCalls++;
            Main.showNotification(
                "Nicovideo requests failed after "
                + MAX_CALL_ATTEMPTS.toString()
                + " tries: "
                + numFailedCalls.toString());
        }
        else {
            var nlvResponse = response.nicolive_video_response;
            
            // If count is 0 then there is no video_info key, so need to check.
            if (nlvResponse.count > 0) {
                var videoInfos = nlvResponse.video_info;
                $.each(videoInfos, function(i, videoInfo){
                    allLiveStreams.push(videoInfo);
                });
            }
        }
        
        liveStreamsCallsCompleted++;
        if (liveStreamsCallsCompleted === liveStreamsCallsExpected) {
            // allLiveStreams has all the live streams now. Next step is to get
            // only the streams we're interested in, and only the info we need
            // from them.
            Main.getFunc('Nico.setStreams')();
        }
    }
    
    function setStreams() {
        
        streamDicts = [];
        
        var followingCommunitiesStr = Settings.get('nicoCommunities');
        var followingCommunities = Util.splitlines(followingCommunitiesStr);
        
        $.each(allLiveStreams, function(i, vInfo){
            var globalId = vInfo.community.global_id;
            
            if (followingCommunities.indexOf(globalId) === -1) {
                // Not following this community, don't add to streamDicts
                return;
            }
            
            var d = {};
            
            d.channelLink = 'http://live.nicovideo.jp/watch/' + vInfo.video.id;
            if (vInfo.video._thumbnail_url !== undefined) {
                d.thumbnailUrl = vInfo.video._thumbnail_url;
            }
            else {
                d.thumbnailUrl = vInfo.community.thumbnail;
            }
            d.title = vInfo.video.title;
            d.gameName = null;
            d.viewCount = vInfo.video.view_counter;
            d.channelName = vInfo.community.name;
            d.site = 'Nico';
            
            streamDicts.push(d);
        });
    }
    
    function getVideos() {
        
        // TODO: Implement for real
        Main.getFunc('Nico.setVideos')(errorIndicator);
    }
    
    function setVideos(response) {
        
        if (response === errorIndicator) {
            // Nico's response is an error.
            videoDicts = [];
            return;
        }
        
        // TODO: Implement for real
        videoDicts = [];
    }
    
    
    
    function setRequirements() {
        
        Main.addFunc('Nico.setStreams', setStreams);
        Main.addFunc('Nico.setVideos', setVideos);
        Main.addFunc('Nico.finishGettingAllLiveStreams', finishGettingAllLiveStreams);
        Main.addFunc('Nico.addToAllLiveStreams', addToAllLiveStreams);
        
        Main.addRequirement('Nico.setStreams', 'Main.showStreams');
        
        Main.addRequirement('Nico.setVideos', 'Main.showVideos');
    }
    
    
    
    function refreshCommunitiesTable() {
        var followingCommunitiesStr = Settings.get('nicoCommunities');
        $coTableContainer.empty();
        
        if (followingCommunitiesStr === "") {
            // No communities specified
            $coTableContainer.text("(None)");
            return;
        }
        
        // Communities specified; make a table out of them
        var $coTable = $(document.createElement('table'));
        var $coTableBody = $(document.createElement('tbody'));
        $coTable.append($coTableBody);
        $coTableContainer.append($coTable);
        
        var followingCommunities = Util.splitlines(followingCommunitiesStr);
        
        followingCommunities.forEach(function(co){
            var $row = $(document.createElement('tr'));
            
            var $coCell = $(document.createElement('td'));
            $coCell.text(co);
            $row.append($coCell);
            
            var $linkCell = $(document.createElement('td'));
            if (coRegex.exec(co) !== null) {
                var $anchor = $(document.createElement('a'));
                $anchor.attr('href', 'http://com.nicovideo.jp/community/'+co);
                $anchor.attr('target', '_blank');
                $anchor.text("OK");
                $linkCell.append($anchor);
            }
            else {
                $linkCell.text("Error - typo?");
            }
            $row.append($linkCell);
            
            $coTableBody.append($row);
        });
    }
    
    function initSettings() {
        $coTableContainer = $('#nicoCommunities-table-container');
        $coEditArea = $('#edit-nicoCommunities');
        $coEditButton = $('#edit-button-nicoCommunities');
        $coConfirmArea = $('#confirm-nicoCommunities');
        $coConfirmButton = $('#confirm-button-nicoCommunities');
        
        $coEditButton.click(function(e) {
            $coEditArea.show();
            $coConfirmArea.hide();
        });
        $coConfirmButton.click(function(e) {
            refreshCommunitiesTable();
            $coConfirmArea.show();
            $coEditArea.hide();
        });
        
        refreshCommunitiesTable();
    }
    
    
    
    // Public methods
    
    return {
        
        setRequirements: function() {
            setRequirements();
        },
        startGettingMedia: function() {
            startGettingAllLiveStreams(1);
            getVideos();
        },
        
        getStreamDicts: function() {
            return streamDicts;
        },
        getVideoDicts: function() {
            return videoDicts;
        },
        
        refreshCommunitiesTable: function() {
            refreshCommunitiesTable();
        },
        initSettings: function() {
            initSettings();
        }
    }
})();
