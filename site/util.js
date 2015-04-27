var Util = {
    
    curry: function(orig_func) {
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
    },
    
    refreshPage: function() {
        window.location.reload();
    },
    
    splitlines: function(s){
        /* Split a string s by its newline characters. Return the
        resulting multiple strings as an array.
        This regex should handle \r\n, \r, and \n. */
        return s.split(/\r\n|[\n\r]/);
    },
    
    
    
    /* Arrays */
    
    removeFromArray: function(arr, value) {
        /* Remove all instances of value from the array arr. */
        for(var i = arr.length - 1; i >= 0; i--) {
            if(arr[i] === value) {
               arr.splice(i, 1);
            }
        }
    },
    
    sortedLocation: function(element, array, comparer, start, end) {
        /* Determine where the element would go in the already-sorted
        array if inserted.
        The return value is the index AFTER which the element would be
        inserted. -1 means at the beginning of the array.
        
        Source: http://stackoverflow.com/a/18341744/ and /a/20261974/ */
        if (array.length === 0) {return -1;}
    
        start = start || 0;
        end = end || array.length;
        var pivot = parseInt(start + (end - start) / 2, 10);
        if (array[pivot] === element) {return pivot;}

        var c = comparer(element, array[pivot]);
        if (end - start <= 1) {return c < 0 ? pivot - 1 : pivot;}

        if (c < 0) {
            return Util.sortedLocation(element, array, comparer, start, pivot);
        } else if (c === 0) {
            return pivot;
        } else {  // c > 0
            return Util.sortedLocation(element, array, comparer, pivot, end);
        }
    },
    
    sortedInsert: function(element, array, comparer) {
        /* Insert element into the already-sorted array. comparer
        defines the sorting comparison method.
        
        Source: http://stackoverflow.com/questions/1344500/ */
        
        array.splice(Util.sortedLocation(element, array, comparer) + 1, 0, element);
        return array;
    },
    
    
    
    /* Date/time utility functions */
    
    dateObjToTimeAgo: function(dateObj) {
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
    },
    
    timeSecToHMS: function(totalSeconds) {
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
    
};
