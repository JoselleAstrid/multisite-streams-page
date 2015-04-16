var Nico = (function() {
    
    var streamDicts = null;
    var videoDicts = null;
    
    var errorIndicator = "There was an error previously";
    
    // Max number of streams we can get in a single API call.
    // For search.solr, http://www59.atwiki.jp/nicoapi/pages/48.html says
    // the max is 149, but it's actually 100.
    var MAX_STREAMS_IN_CALL = 100;
    // Max number of times we'll try a particular API call before giving up.
    var MAX_CALL_ATTEMPTS = 3;
    
    var allLiveStreams = null;
    var liveStreamsCallsExpected = null;
    var liveStreamsCallsCompleted = null;
    
    
    // TODO: Move this function to a Util module
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
    
    
    function yqlProxyAjax(urls, callback, attemptNum) {
        /*
        urls: API URL(s) we want to get, either string or array of strings
        options: Any jQuery.ajax() options except url and data
        */
        var urlsForQuery = '';
        
        if ($.type(urls) === 'string') {
            urlsForQuery = '"' + urls + '"';
        }
        else {
            $.each(urls, function(i, url){
                if (i > 0) {
                    urlsForQuery += ', ';
                }
                urlsForQuery += ('"' + url + '"');
            });
        }
        
        var options = {
            type: 'POST',
            dataType: 'json',
            url: 'https://query.yahooapis.com/v1/public/yql',
            data: {
                q: 'select * from json where url in (' + urlsForQuery + ')',
                format: 'json'
            },
            success: curry(
                function(urls_, callback_, attemptNum_, response){
                    // YQL failed to call Nico.
                    if (response.query.results === null) {
                        // Try again if we haven't reached the max attempts.
                        if (attemptNum_ < MAX_CALL_ATTEMPTS) {
                            yqlProxyAjax(urls_, callback_, attemptNum_+1);
                        }
                        else {
                            Main.showNotification(
                                "Nicovideo request came back empty "
                                + MAX_CALL_ATTEMPTS.toString()
                                + " times; giving up.");
                            // TODO: Check if this is the right error
                            // handling to use.
                            callback(errorIndicator);
                        }
                        return;
                    }
                    // Call succeeded.
                    callback(response)
                },
                urls, callback, attemptNum
            ),
            error: function(response){
                // TODO: Check if this is the right error handling to use.
                callback(errorIndicator)
            }
        };
        $.ajax(options);
    }
    
    
    function startGettingAllLiveStreams(attemptNum) {
        
        // Make an API call to get the first 'page' of all live streams.
        
        var url =
            'http://api.ce.nicovideo.jp/liveapi/v1/video.search.solr'
            + '?__format=json'
            + '&word=ゲーム'
            + '&limit=' + MAX_STREAMS_IN_CALL.toString();
        
        // To call Nico's API without getting a Cross Origin error, use CORS
        // via YQL (Yahoo) proxy.
        yqlProxyAjax(url, Main.getFunc('Nico.finishGettingAllLiveStreams'), 1);
    }
    
    function finishGettingAllLiveStreams(response) {
        
        if (response === errorIndicator) {
            // YQL's response is an error.
            streamDicts = [];
            return;
        }
        
        var nlvResponse = response.query.results.nicolive_video_response;
        var totalCount = parseInt(nlvResponse.total_count.filtered);
        liveStreamsCallsExpected = 1;
        allLiveStreams = [];
        
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
                + '&word=ゲーム'
                + '&from=' + currentIndex.toString()
                + '&limit=' + MAX_STREAMS_IN_CALL.toString()
            );
            
            currentIndex += MAX_STREAMS_IN_CALL;
            liveStreamsCallsExpected++;
        }
        
        // Add the streams obtained from our first call.
        addToAllLiveStreams(response);
        
        $.each(urls, function(i, url){
            yqlProxyAjax(url, Main.getFunc('Nico.addToAllLiveStreams'), 1);
        });
    }
    
    function addToAllLiveStreams(response) {
        
        if (response === errorIndicator) {
            // YQL's response is an error.
            streamDicts = [];
            return;
        }
        
        if (response.query.results === null) {
            // YQL didn't get any results.
        }
        
        var nlvResponse = response.query.results.nicolive_video_response;
        
        // If count is 0 then there is no video_info key, so need to check.
        if (nlvResponse.count > 0) {
            var videoInfos = nlvResponse.video_info;
            $.each(videoInfos, function(i, videoInfo){
                allLiveStreams.push(videoInfo);
            });
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
        
        // TODO: Use a list from settings, not hard-coded
        var following = [
            'co156608',
            'co302682',
            'co340381',
            'co393786',
            'co403229',
            'co1022062',
            'co1267031',
            'co1739309',
            'co1866040',
            'co1910962',
            'co1978916',
            'co2001121',
            'co2028854',
            'co2299498',
            'co2335880',
            'co2399333',
            'co2517294',
            'co2616234',
            'co2632757',
            'co2720991',
            'co2745772',
            'co2759290',
            'co2791640'
        ];
        
        $.each(allLiveStreams, function(i, vInfo){
            var globalId = vInfo.community.global_id;
            
            if (following.indexOf(globalId) === -1) {
                // Not following this stream, don't add it to streamDicts
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
        //Main.addFunc('Nico.finishSettingAllLiveStreams', finishSettingAllLiveStreams);
        Main.addFunc('Nico.addToAllLiveStreams', addToAllLiveStreams);
        
        Main.addRequirement('Nico.setStreams', 'Main.showStreams');
        
        Main.addRequirement('Nico.setVideos', 'Main.showVideos');
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
        }
    }
})();
