var Settings = {
    
    defaults: {
        'twitchEnabled': true,
        'hitboxEnabled': true,
        'nicoEnabled': false,
        'hitboxUsername': '',
        'gameDisplay': 'boximage',
        'streamLimit': 25,
        'videoLimit': 10,
        'hitboxThumbnailServer': 'vie'
    },
    
    $form: null,
    
    show: function(saveCallback, cancelCallback) {
        
        var saveFunction = function(){
            Settings.formToCookie();
            saveCallback();
        }
        var cancelFunction = function(){
            // Revert any changes the user might've made
            Settings.cookieToForm();
            cancelCallback();
        }
        
        Settings.$form.dialog({
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
    },
    
    
    
    /* Browser cookie <--> cookie string
    From: http://www.quirksmode.org/js/cookies.html */
    createCookie: function(name,value,days) {
        if (days) {
            var date = new Date();
            date.setTime(date.getTime()+(days*24*60*60*1000));
            var expires = "; expires="+date.toGMTString();
        }
        else var expires = "";
        document.cookie = name+"="+value+expires+"; path=/";
    },
    readCookie: function(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for(var i=0;i < ca.length;i++) {
            var c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
    },
    
    /* Browser cookie <--> settings form */
    cookieToForm: function() {
        var settingsStr = Settings.readCookie('settings');
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
        var $fieldElmts = Settings.$form.find('input, select');
        var cookieNeedsUpdate = false;
        for (i = 0; i < $fieldElmts.length; i++) {
            var $field = $($fieldElmts[i]);
            var settingName = $field.attr('name');
            if (settingsFromCookie.hasOwnProperty(settingName)) {
                Settings.setInForm(settingName, settingsFromCookie[settingName]);
            }
            else {
                Settings.setInForm(settingName, Settings.defaults[settingName]);
                cookieNeedsUpdate = true;
            }
        }
        if (cookieNeedsUpdate) {
            Settings.formToCookie();
        }
        
        return true;
    },
    /* We'll format the settings cookie like:
    settingname1>value1|settingname2>value2|... */
    formToCookie: function() {
        var $fieldElmts = Settings.$form.find('input, select');
        var i;
        var nameValuePairs = [];
        
        for (i = 0; i < $fieldElmts.length; i++) {
            var $field = $($fieldElmts[i]);
            var settingName = $field.attr('name');
            var settingValue = Settings.get(settingName);
            nameValuePairs.push(settingName + '>' + settingValue);
        }
        
        var settingsStr = nameValuePairs.join('|');
        
        Settings.createCookie('settings', settingsStr, 365*10);
    },
    
    /* Settings form <--> settings as JS values */
    get: function(name) {
        var $fieldElmt = Settings.$form.find(
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
    },
    setInForm: function(name, value) {
        var $fieldElmt = Settings.$form.find(
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
    },
    
    fillFormWithDefaults: function() {
        // Fill the settings form with default values
        for (settingName in Settings.defaults) {
            if (!Settings.defaults.hasOwnProperty(settingName)) {continue;}
            Settings.setInForm(settingName, Settings.defaults[settingName]);
        }
    },
    
    
    init: function() {
        Settings.$form = $('#settings-form');
    }

};
