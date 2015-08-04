/*
Settings are in local storage.
*/



var Settings = {
    
    defaults: {
        'twitchEnabled': true,
        'hitboxEnabled': true,
        'nicoEnabled': false,
        'cavetubeEnabled': false,
        'gameDisplay': 'boximage',
        'sortStreams': 'viewersDesc',
        'sortHosts': 'viewersDesc',
        'sortGames': 'viewersDesc',
        'mergeHosts': true,
        'videoLimit': 30,
        'sectionOrder': ['streams', 'hosts', 'games', 'videos'],
        
        'hitboxUsername': '',
        'hitboxThumbnailServer': 'vie',
        
        'nicoCommunities': [],
        'nicoSearchKeywords': 'rta, 練習+ゲーム',
        
        'cavetubeUsers': []
    },
    
    fieldTypes: ['input', 'select', 'textarea'],
    
    // Settings values that aren't just strings, and thus need to be
    // stored somewhere other than an input field
    sectionOrder: null,
    nicoCommunities: null,
    cavetubeUsers: null,
    
    $container: null,
    
    mainTabInitialized: false,
    nicoTabInitialized: false,
    cavetubeTabInitialized: false,
    
    sectionNames: {
        streams: "Streams",
        hosts: "Hosts",
        games: "Games",
        videos: "Videos"
    },
    
    
    
    get$field: function(key) {
        var selector = Settings.fieldTypes.map(
            function(fieldType){return fieldType+'[name="'+key+'"]';}
        ).join(', ');
        return Settings.$container.find(selector);
    },
    
    
    
    show: function(saveCallback, cancelCallback) {
        /* If cancelCallback is null, then there should be no Cancel
        or close buttons. This makes sense when the user is
        prompted to set settings on their first visit. */
        
        var buttons = {};
        var dialogClass = "";
        
        // Add Save button
        buttons.Save = function(){
            Settings.fieldsToStorage();
            saveCallback();
            $(this).dialog("close");
        };
        
        if (cancelCallback !== null) {
            // Add Cancel button
            buttons.Cancel = function(){
                // Cancel button click: Revert changes the user might've made
                Settings.storageToFields();
                cancelCallback();
                $(this).dialog("close");
            };
        }
        else {
            // No cancel callback: Don't add a Cancel button, and also
            // specify a CSS class that hides the close button
            dialogClass = "no-close";
        }
        
        if (!Settings.mainTabInitialized) {
            Settings.initMainSettings();
            Settings.mainTabInitialized = true;
        }
        
        Settings.$container.dialog({
            title: "Settings",
            modal: true,
            buttons: buttons,
            dialogClass: dialogClass,
            width: 500,
            position: { my: "center top", at: "center top+20", of: window }
        });
    },
    
    
    
    /* Local storage <--> settings fields */
    
    hasStorage: function() {
        return (localStorage.length > 0);
    },
    
    storageToFields: function() {
        // Go through each setting to set the settings fields. (This is either
        // an input field or a field/property of Settings.)
        //
        // If storage covers it, use the value from storage.
        // If storage doesn't cover it (probably a newly added setting
        // since the user's last visit), set the default value, AND
        // update the other way, fields to storage.
        var settingsKeys = Object.keys(Settings.defaults);
        var storageNeedsUpdate = false;
        
        settingsKeys.forEach(function(key) {
            if (localStorage.hasOwnProperty(key)) {
                // Use JSON.parse since local storage can only have strings,
                // while our settings can be in any format.
                Settings.setInField(key, JSON.parse(localStorage[key]));
            }
            else {
                Settings.setInField(key, Settings.defaults[key]);
                storageNeedsUpdate = true;
            }
        });
        if (storageNeedsUpdate) {
            Settings.fieldsToStorage();
        }
    },
    
    fieldsToStorage: function() {
        var settingsKeys = Object.keys(Settings.defaults);
        
        settingsKeys.forEach(function(key) {
            var settingValue = Settings.get(key);
            // Use JSON.stringify since our settings can be in any format,
            // while local storage only accepts strings.
            localStorage[key] = JSON.stringify(settingValue);
        });
    },
    
    
    
    /* Settings field <--> setting as JS values */
    
    get: function(key) {
        // Case 1: There's a Settings field for this setting.
        if (Settings.hasOwnProperty(key)) {
            return Settings[key];
        }
        
        // Case 2: There's an HTML field element for this setting.
        var $fieldElmt = Settings.get$field(key);
        if ($fieldElmt) {
            if ($fieldElmt.attr('type') === 'checkbox') {
                return $fieldElmt.prop('checked');
            }
            else if ($fieldElmt.attr('type') === 'radio') {
                // This works for select, input/type=text, and textarea.
                return $fieldElmt.filter(':checked').val();
            }
            else {
                // This works for select, input/type=text, and textarea.
                return $fieldElmt.val();
            }
        }
        
        // Couldn't find this setting.
        return null;
    },
    
    setInField: function(key, value) {
        // Case 1: There's a Settings field for this setting.
        if (Settings.hasOwnProperty(key)) {
            Settings[key] = value;
            return true;
        }
        
        // Case 2: There's an HTML field element for this setting.
        var $fieldElmt = Settings.get$field(key);
        if ($fieldElmt) {
            if ($fieldElmt.attr('type') === 'checkbox') {
                // This will handle strings of 'true' or 'false',
                // or boolean values.
                $fieldElmt.prop('checked', (value === true || value === 'true'));
            }
            else if ($fieldElmt.attr('type') === 'radio') {
                // In this case $fieldElmt is actually multiple elements - each
                // of the radio button choices. This line checks the appropriate
                // radio button and unchecks the others. Note how the parameter
                // needs to be an array for this behavior to happen.
                $fieldElmt.val([value]);
            }
            else {
                // This works for select, input/type=text, and textarea.
                $fieldElmt.val(value);
            }
            return true;
        }
        
        // Couldn't find this setting.
        return false;
    },
    
    
    
    fillFieldsWithDefaults: function() {
        // Fill the settings fields with default values
        Object.keys(Settings.defaults).forEach(function(key){
            Settings.setInField(key, Settings.defaults[key]);
        });
    },
    
    
    
    initMainSettings: function() {
        var sectionOrder = Settings.get('sectionOrder');
        
        var i;
        for (i = 0; i < sectionOrder.length; i++) {
            // Set value of one section order item
            var sectionVal = sectionOrder[i];
            var $input = $('#field-sectionOrder-' + i.toString());
            $input.val(sectionVal);
            // Set display of one section order item
            var $span = $('#sectionOrder-' + i.toString() + '-text');
            $span.text(Settings.sectionNames[sectionVal]);
        }
        
        $('button.sectionOrder-button').click(function() {
            var name = $(this).attr('name');
            // name is 2 numerical digits, representing the two sections
            // that the button will switch
            var sectionNum1 = name.slice(0,1);
            var sectionNum2 = name.slice(1);
            
            var $span1 = $('#sectionOrder-' + sectionNum1 + '-text');
            var $span2 = $('#sectionOrder-' + sectionNum2 + '-text');
            var $input1 = $('#field-sectionOrder-' + sectionNum1);
            var $input2 = $('#field-sectionOrder-' + sectionNum2);
            
            var value1 = $input1.val();
            var value2 = $input2.val();
            $input1.val(value2);
            $input2.val(value1);
            
            var text1 = $span1.text();
            var text2 = $span2.text();
            $span1.text(text2);
            $span2.text(text1);
        
            var sectionOrder = [];
            var numOfSections = Object.keys(Settings.sectionNames).length;
            var i;
            for (i = 0; i < numOfSections; i++) {
                var $input = $('#field-sectionOrder-' + i.toString());
                var sectionVal = $input.val();
                sectionOrder.push(sectionVal);
            }
            Settings.setInField('sectionOrder', sectionOrder);
        });
    },
    
    
    
    init: function() {
        // Get the container element which has all the settings
        Settings.$container = $('#settings');
        
        // Initialize the tabbed layout of the settings.
        Settings.$container.tabs({
            // Function to run before we switch to another tab.
            beforeActivate: function(event, ui) {
                if (ui.newTab.context.hash === '#settings-nico') {
                    if (!Settings.nicoTabInitialized) {
                        Nico.initSettings();
                        Settings.nicoTabInitialized = true;
                    }
                }
                else if (ui.newTab.context.hash === '#settings-cavetube') {
                    if (!Settings.cavetubeTabInitialized) {
                        Cavetube.initSettings();
                        Settings.cavetubeTabInitialized = true;
                    }
                }
            }
        });
    }
    
};
