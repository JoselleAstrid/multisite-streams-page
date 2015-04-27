/*
Settings are in local storage.
*/



var Settings = {
    
    defaults: {
        'twitchEnabled': true,
        'hitboxEnabled': true,
        'nicoEnabled': false,
        'displayTiming': 'asTheyArrive',
        
        'hitboxUsername': '',
        'gameDisplay': 'boximage',
        'streamLimit': 25,
        'videoLimit': 10,
        'hitboxThumbnailServer': 'vie',
        
        'nicoCommunities': []
    },
    
    fieldTypes: ['input', 'select', 'textarea'],
    
    // Settings values that aren't just strings, and thus need to be
    // stored somewhere other than an input field
    nicoCommunities: null,
    
    $container: null,
    nicoTabInitialized: false,
    
    
    
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
    
    
    
    init: function() {
        // Get the container element which has all the settings
        Settings.$container = $('#settings');
        // Initialize the tabbed layout of the settings 
        Settings.$container.tabs({
            beforeActivate: function(event, ui) {
                if (ui.newTab.context.hash === '#settings-nico') {
                    if (!Settings.nicoTabInitialized) {
                        Nico.initSettings();
                        Settings.nicoTabInitialized = true;
                    }
                }
            }
        });
    }
    
};
