var Cavetube = (function() {
    
    var $userTableContainer = null;
    var $userEditArea = null;
    var $userEditButton = null;
    var $userConfirmArea = null;
    var $userConfirmButton = null;
    
    var errorIndicator = "There was an error previously";
    
    // Track server calls/requests.
    var numTotalRequests = 0;
    var numCompletedRequests = 0;
    
    // Max number of streams we can get in a single API call.
    // Have seen at least 130 at http://rss.cavelis.net/index_live.xml, but
    // not sure what the real max is.
    var MAX_STREAMS_IN_CALL = 130;
    // Max number of times we'll try a particular API call before giving up.
    var MAX_CALL_ATTEMPTS = 2;
    
    // Max number of API calls to have active in parallel. Too few and it may
    // take too long for everything to finish. Too many and some calls might
    // time out since they waited too long.
    var MAX_ACTIVE_CALLS = 6;
    var numActiveCalls = 0;
    var callQueue = [];
    
    // Track unique server calls/requests (i.e. not counting retries). 
    var numTotalRequests = 0;
    var numCompletedRequests = 0;
    var numFailedRequests = 0;
    
    var followingUsers = [];
    
    
    
    function incTotalRequests() {
        numTotalRequests++;
        Main.updateRequestStatus("Cavetube", numTotalRequests, numCompletedRequests);
    }
    function incCompletedRequests() {
        numCompletedRequests++;
        Main.updateRequestStatus("Cavetube", numTotalRequests, numCompletedRequests);
    }
    
    function requestsAreDone() {
        return numTotalRequests === numCompletedRequests;
    }
    
    function reportFailedRequest() {
        numFailedRequests++;
        Main.showNotification(
            "Cavetube requests failed after "
            + MAX_CALL_ATTEMPTS.toString()
            + " tries: "
            + numFailedRequests.toString() + " of "
            + numCompletedRequests.toString());
    }
    
    
    
    function proxyAjax(
        url, params, callback, tracked, attemptNum, wasQueued) {
        /* tracked: boolean. If true, we'll track this request in the
        request status display, and we'll factor this request into logic
        that checks whether all the requests are done.
        
        attemptNum: Number of times we've attempted this particular
        server request. If the server response is a generic failure, then
        we'll make another attempt, until we hit the max number of attempts.
        
        wasQueued: boolean. If true, that means this request was previously
        queued because we had reached the max number of active requests. */
    
        if (tracked === undefined) {tracked = true;}
        if (attemptNum === undefined) {attemptNum = 1;}
        if (wasQueued === undefined) {wasQueued = false;}
        
        if (tracked && attemptNum === 1 && !wasQueued) {
            incTotalRequests();
        }
        
        if (numActiveCalls >= MAX_ACTIVE_CALLS) {
            callQueue.push(
                Util.curry(
                    proxyAjax, url, params, callback,
                    tracked, attemptNum, true
                )
            );
            return;
        }
        
        // Get the proxy request server from Config. If this is not set, then
        // default to Yahoo's YQL. (It's not the most reliable proxy,
        // but it's the only proxy known that's run by a big company, so
        // this app's load should be minimal for them.)
        var proxyRequestServer = Config.proxyRequestServer || 'yql';
        
        var successCallback = Util.curry(
            function(callback_, tracked_, response){
                numActiveCalls--;
                if (callQueue.length > 0) {
                    var waitingAjaxCall = callQueue.shift();
                    waitingAjaxCall();
                }
                
                callback_(response);
                if (tracked_) {incCompletedRequests();}
            },
            callback, tracked
        );
        var errorCallback = Util.curry(
            function(url_, params_, callback_, tracked_, attemptNum_, response){
                numActiveCalls--;
                
                // If any pending Ajax calls are waiting, dequeue a call. 
                if (callQueue.length > 0) {
                    var waitingAjaxCall = callQueue.shift();
                    waitingAjaxCall();
                }
                
                if (attemptNum_ >= MAX_CALL_ATTEMPTS) {
                    // Reached the max number of attempts for this call;
                    // giving up.
                    if (tracked_) {
                        incCompletedRequests();
                        reportFailedRequest();
                    }
                    else {
                        callback_(errorIndicator);
                    }
                }
                else {
                    // Trying again.
                    proxyAjax(url_, params_, callback_, tracked_, attemptNum_+1);
                }
            },
            url, params, callback, tracked, attemptNum
        );
        
        var proxyUrl;
        if (proxyRequestServer === 'yql') {
            // For Yahoo's YQL, the request must be built in a particular way,
            // and the response must be unwrapped as well.
            proxyUrl = 'https://query.yahooapis.com/v1/public/yql';
            
            var requestUrl = url + '?' + $.param(params);
            var query = 'select * from xml where url="' + requestUrl + '"';
            params = {'q': query, 'format': 'xml'};
            
            successCallback = Util.curry(
                function(succCallback, errCallback, response){
                    // In the response element there's a query element, and
                    // in that is the results element.
                    var results = response.children[0].children[0];
                    
                    // In that results element is the root XML element from
                    // the website.
                    if (results.children.length > 0) {
                        // Wrap in a documentElement property so that it can be
                        // handled the same way as a non-YQL-wrapped response.
                        succCallback({'documentElement': results.children[0]});
                    }
                    else {
                        // YQL failed to get the website's response.
                        errCallback(null);
                    }
                },
                successCallback, errorCallback
            );
        }
        else {
            // If the proxy server's not YQL, then it's assumed to work by
            // simply appending the request URL to a base URL (which should be
            // the proxyRequestServer value), and it's assumed to return the
            // request as-is instead of wrapping it (unlike YQL).
            //
            // For example, the following Node-run proxy has this behavior:
            // https://www.npmjs.com/package/cors-anywhere
            proxyUrl = proxyRequestServer + url;
        }
        
        var options = {
            type: 'GET',
            dataType: 'xml',
            url: proxyUrl,
            data: params,
            success: successCallback,
            error: errorCallback
        };
        $.ajax(options);
        
        numActiveCalls++;
    }
    
    
    
    function getStreams() {
        // Make an API call to get all live streams.
        var url = 'http://rss.cavelis.net/index_live.xml';
        var params = {};
        
        proxyAjax(
            url, params,
            setStreams
        );
    }
    
    
    
    function setStreams(response) {
        var allStreams;
        
        if (response === errorIndicator) {
            // This is our case when the Hitbox streams response is an error.
            // This could either be an actual error or just no streams...
            // not knowing any better, we'll treat it as no streams.
            allStreams = [];
        }
        else {
            allStreams = [];
            var i;
            var rootElement = response.documentElement;
            for (i = 0; i < rootElement.children.length; i++) {
                var element = rootElement.children[i];
                // Only <entry> tags represent streams here.
                if (element.tagName === 'entry') {
                    allStreams.push(element);
                }
            };
        }
        
        
        var users = Settings.get('cavetubeUsers');
        var followingUsernames = users.map(function(x){return x.username;});
        
        if (Settings.get('cavetubeUsers').length === 0) {
            Main.showNotification(
                "You haven't specified any Cavetube users to watch for."
            );
            return;
        }
        
        
        var streamDicts = [];
        
        allStreams.forEach(function(element){
            var props = {};
            var i;
            for (i = 0; i < element.children.length; i++) {
                var propE = element.children[i];
                props[propE.tagName] = Util.trimString(propE.textContent);
            };
            
            if (followingUsernames.indexOf(props.author) === -1) {
                // Not following this community, don't add to streamDicts
                return;
            }
        
            var d = {};
            
            d.channelLink = 'http://gae.cavelis.net/live/' + props.author;
            // This stream preview thumbnail actually involves a separate
            // request, whose URL can be built using the stream properties.
            // To make this request, we'll just let this URL eventually be
            // put in a img element's src attribute. No explicit call needed.
            d.thumbnailUrl = 
                'http://ss.cavelis.net:3001/take?url='
                + props['ct:host_url'] + '/'
                + props['ct:stream_name'] + '&' + Date.now().toString();
            d.streamTitle = props.title;
            d.gameName = "Not supported";
            // ct:viewer is total views, not necessarily current viewers.
            // ct:listener is current viewers.
            d.viewCount = props['ct:listener'];
            d.channelName = props.author;
            d.site = 'Cavetube';
            
            streamDicts.push(d);
        });
        
        Main.addStreams(streamDicts);
    }
    
    
    
    function startEditingUsers() {
        var users = Settings.get('cavetubeUsers');
        var usernames = users.map(function(x){return x.username;});
        $('#textarea-cavetubeUsers').text(usernames.join('\n'));
    }
    
    function finishEditingUsers() {
        var text = $('#textarea-cavetubeUsers').val();
        if (text === "") {
            Settings.setInField('cavetubeUsers', []);
            return;
        }
        
        var usernames = Util.splitlines(text);
        var users = [];
        usernames.forEach(function(username){
            users.push({'username': username});
        });
        Settings.setInField('cavetubeUsers', users);
    }
    
    function refreshUsersTable() {
        
        var users = Settings.get('cavetubeUsers');
        
        $('#cavetube-user-count').text(users.length.toString());
        $userTableContainer.empty();
        
        if (users.length === 0) {
            // No users specified
            $userTableContainer.text("(None)");
            return;
        }
        
        // Users specified; make a table out of them
        var $userTable = $(document.createElement('table'));
        var $userTableBody = $(document.createElement('tbody'));
        $userTable.append($userTableBody);
        $userTableContainer.append($userTable);
        
        users.forEach(function(user){
            var username = user.username;
            var $row = $(document.createElement('tr'));
            $userTableBody.append($row);
            
            var $usernameCell = $(document.createElement('td'));
            $row.append($usernameCell);
            
            var $anchor = $(document.createElement('a'));
            $anchor.attr('href', 'http://gae.cavelis.net/user/'+username);
            $anchor.attr('target', '_blank');
            $anchor.text(username);
            $usernameCell.append($anchor);
        });
    }
        
        
    
    function initSettings() {
        $userTableContainer = $('#cavetubeUsers-table-container');
        $userEditArea = $('#edit-cavetubeUsers');
        $userEditButton = $('#edit-button-cavetubeUsers');
        $userConfirmArea = $('#confirm-cavetubeUsers');
        $userConfirmButton = $('#confirm-button-cavetubeUsers');
        
        $userEditButton.click(function(e) {
            startEditingUsers();
            $userEditArea.show();
            $userConfirmArea.hide();
        });
        $userConfirmButton.click(function(e) {
            finishEditingUsers();
            refreshUsersTable();
            $userConfirmArea.show();
            $userEditArea.hide();
        });
        
        refreshUsersTable();
    }
    
    
    
    // Public methods
    
    return {
        
        startGettingMedia: function() {
            getStreams();
        },
        requestsAreDone: function() {
            return requestsAreDone();
        },
        
        refreshUsersTable: function() {
            refreshUsersTable();
        },
        initSettings: function() {
            initSettings();
        }
    }
})();
