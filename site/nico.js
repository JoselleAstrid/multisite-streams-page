var Nico = (function() {
    
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
    var MAX_CALL_ATTEMPTS = 2;
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
    
    // Stream search keywords: hardcoded for now. May make this a setting later.
    var searchKeywords = ["rta", "ゲーム+練習"];
    //var searchKeywords = ["ゲーム"];
    
    var followingCos = [];
    var addedStreamCos = [];
    
    var liveStreamsCallsExpected = 0;
    var liveStreamsCallsCompleted = 0;
    var numTotalCalls = 0;
    var numFailedCalls = 0;
    
    
    function proxyAjax(url, params, callback, attemptNum) {
        
        if (numActiveCalls >= MAX_ACTIVE_CALLS) {
            callQueue.push(Util.curry(proxyAjax, url, params, callback, attemptNum));
            return;
        }
        
        var options = {
            type: 'POST',
            dataType: 'json',
            url: PROXY_REQUEST_SERVER + url,
            data: params,
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
                function(url_, params_, callback_, attemptNum_, response){
                    numActiveCalls--;
                    if (callQueue.length > 0) {
                        var waitingAjaxCall = callQueue.shift();
                        waitingAjaxCall();
                    }
                    
                    // Try again if we haven't reached the max attempts.
                    if (attemptNum_ < MAX_CALL_ATTEMPTS) {
                        proxyAjax(url_, params_, callback_, attemptNum_+1);
                    }
                    else {
                        callback(errorIndicator);
                    }
                },
                url, params, callback, attemptNum
            )
        };
        $.ajax(options);
        
        numActiveCalls++;
    }
    
    
    function startGettingAllLiveStreams() {
        
        var followingCommunities = Settings.get('nicoCommunities');
        // co<number> ids of following streams
        followingCos = followingCommunities.map(function(x){return x.co;});
        // Track which communities we've found as live streams already
        addedStreamCos = [];
        
        if (Settings.get('nicoCommunities').length === 0) {
            Main.showNotification(
                "You haven't specified any Nicovideo communities to watch for."
            );
            setStreams();
            return;
        }
        
        searchKeywords.forEach(function(keyword){
                
            // Make an API call to get the first 'page' of live streams under
            // this keyword.
            //
            // To call Nico's API without getting a Cross Origin error, use CORS
            // via proxy.
            var params = {
                '__format': 'json',
                'word': keyword,
                'limit': MAX_STREAMS_IN_CALL.toString()
            };
            
            liveStreamsCallsExpected++;
            proxyAjax(
                'http://api.ce.nicovideo.jp/liveapi/v1/video.search.solr',
                params,
                Util.curry(continueGettingLiveStreams, keyword),
                1
            );
        });
    }
    
    function continueGettingLiveStreams(keyword, response) {
        
        numTotalCalls++;
        
        if (response === errorIndicator) {
            // Just process this one response and finish.
            setStreams(response);
            return;
        }
        
        var nlvResponse = response.nicolive_video_response;
        var totalCount = parseInt(nlvResponse.total_count.filtered);
        
        if (totalCount <= MAX_STREAMS_IN_CALL) {
            // Oh, we've already retrieved all the live streams.
            // Just process this one response and finish.
            setStreams(response);
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
        var paramSets = [];
        
        while (currentIndex < totalCount) {
            paramSets.push({
                '__format': 'json',
                'word': keyword,
                'from': currentIndex.toString(),
                'limit': MAX_STREAMS_IN_CALL.toString()
            });
            
            currentIndex += MAX_STREAMS_IN_CALL;
        }
        
        paramSets.forEach(function(paramSet){
            liveStreamsCallsExpected++;
            proxyAjax(
                'http://api.ce.nicovideo.jp/liveapi/v1/video.search.solr',
                paramSet,
                setStreams,
                1
            );
        });
        
        // Add the streams obtained from our first call.
        // (Should do this AFTER increasing the calls expected, otherwise the
        // calls completed will match up with the calls expected too soon.)
        setStreams(response);
    }
    
    function setStreams(response) {
        
        var streams = [];
        numTotalCalls++;
        
        if (response === errorIndicator) {
            numFailedCalls++;
            Main.showNotification(
                "Nicovideo requests failed after "
                + MAX_CALL_ATTEMPTS.toString()
                + " tries: "
                + numFailedCalls.toString() + " of "
                + numTotalCalls.toString());
        }
        else {
            var nlvResponse = response.nicolive_video_response;
            
            // If count is 0 then there is no video_info key, so need to check
            // for that case.
            if (nlvResponse.count > 0) {
                nlvResponse.video_info.forEach(function(videoInfo){
                    streams.push(videoInfo);
                });
            }
        }
        
        
        var streamDicts = [];
        
        streams.forEach(function(vInfo){
            var globalId = vInfo.community.global_id;
            
            if (followingCos.indexOf(globalId) === -1) {
                // Not following this community, don't add to streamDicts
                return;
            }
            if (addedStreamCos.indexOf(globalId) !== -1) {
                // Already added this community, don't add to streamDicts
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
            d.gameName = "Not supported on this site";
            d.viewCount = vInfo.video.view_counter;
            d.channelName = vInfo.community.name;
            d.site = 'Nico';
            
            streamDicts.push(d);
            addedStreamCos.push(globalId);
        });
        
        liveStreamsCallsCompleted++;
        Main.addStreams(streamDicts);
    }
    
    function getVideos() {
        
        // TODO: Implement for real
        setVideos();
    }
    
    function setVideos() {
        
        // TODO: Implement for real
        var videoDicts = [];
        
        Main.addVideos(videoDicts);
    }
    
    
    
    function startEditingCommunities() {
        var communities = Settings.get('nicoCommunities');
        var cos = communities.map(function(x){return x.co;});
        $('#textarea-nicoCommunities').text(cos.join('\n'));
    }
    
    function finishEditingCommunities() {
        var text = $('#textarea-nicoCommunities').val();
        if (text === "") {
            Settings.setInField('nicoCommunities', []);
            return;
        }
        
        var cos = Util.splitlines(text);
        var communities = [];
        cos.forEach(function(co){
            communities.push({'co': co});
        });
        Settings.setInField('nicoCommunities', communities);
    }
    
    function refreshCommunitiesTable() {
        // TODO: Handle the case where checking all communities requires
        // multiple calls
        // TODO: Store the checked community names, and check if the table
        // has been changed or not before doing the AJAX thing
        // TODO: Support re-checking in case the network call fails?
        
        var followingCommunities = Settings.get('nicoCommunities');
        
        $('#nico-community-count').text(followingCommunities.length.toString());
        $coTableContainer.empty();
        
        if (followingCommunities.length === 0) {
            // No communities specified
            $coTableContainer.text("(None)");
            return;
        }
        
        // Communities specified; make a table out of them
        var $coTable = $(document.createElement('table'));
        var $coTableBody = $(document.createElement('tbody'));
        $coTable.append($coTableBody);
        $coTableContainer.append($coTable);
        
        var noTypoCos = [];
        
        followingCommunities.forEach(function(community){
            var co = community.co;
            var $row = $(document.createElement('tr'));
            
            var $coCell = $(document.createElement('td'));
            $coCell.addClass('co');
            $coCell.text(co);
            $row.append($coCell);
            
            var $nameCell = $(document.createElement('td'));
            $nameCell.addClass('coName');
            if (coRegex.exec(co) !== null) {
                $nameCell.text("Checking...");
                noTypoCos.push(co);
            }
            else {
                $nameCell.text("Typo?");
            }
            $row.append($nameCell);
            
            $coTableBody.append($row);
        });
        
        var params = {
            '__format': 'json',
            'id': noTypoCos.join(',')
        };
        proxyAjax(
            'http://api.ce.nicovideo.jp/api/v1/community.array',
            params,
            refreshCommunityLinks,
            1
        );
    }
    
    function refreshCommunityLinks(response) {
        
        var $rows = $coTableContainer.find('tr');
        
        if (response === errorIndicator) {
            $rows.each(function(i, row) {
                var $nameCell = $(row).children('td.coName');
                
                if ($nameCell.text() === "Checking...") {
                    $nameCell.text("Checking failed");
                }
            });
            return;
        }
        
        var coToName = {};
        var count = parseInt(response.nicovideo_community_response.count);
        
        if (count > 1) {
            var communities = response.nicovideo_community_response.community;
            communities.forEach(function(community){
                coToName[community.global_id] = community.name;
            });
        }
        else if (count === 1) {
            var community = response.nicovideo_community_response.community;
            coToName[community.global_id] = community.name;
        }
        // Else, count is 0, and there's no entries to add
        
        $rows.each(function(i, row) {
            var $row = $(row);
            var $nameCell = $row.children('td.coName');
            
            if ($nameCell.text() !== "Checking...") {return;}
            
            $nameCell.empty();
            
            var co = $row.children('td.co').text();
            
            if (coToName.hasOwnProperty(co)) {
                var $anchor = $(document.createElement('a'));
                $anchor.attr('href', 'http://com.nicovideo.jp/community/'+co);
                $anchor.attr('target', '_blank');
                $anchor.text(coToName[co]);
                
                $nameCell.append($anchor);
            }
            else {
                $nameCell.text("Not found");
            }
        });
    }
    
    function initSettings() {
        $coTableContainer = $('#nicoCommunities-table-container');
        $coEditArea = $('#edit-nicoCommunities');
        $coEditButton = $('#edit-button-nicoCommunities');
        $coConfirmArea = $('#confirm-nicoCommunities');
        $coConfirmButton = $('#confirm-button-nicoCommunities');
        
        $coEditButton.click(function(e) {
            startEditingCommunities();
            $coEditArea.show();
            $coConfirmArea.hide();
        });
        $coConfirmButton.click(function(e) {
            finishEditingCommunities();
            refreshCommunitiesTable();
            $coConfirmArea.show();
            $coEditArea.hide();
        });
        
        refreshCommunitiesTable();
    }
    
    
    
    // Public methods
    
    return {
        
        startGettingMedia: function() {
            startGettingAllLiveStreams();
            getVideos();
        },
        
        refreshCommunitiesTable: function() {
            refreshCommunitiesTable();
        },
        initSettings: function() {
            initSettings();
        }
    }
})();
