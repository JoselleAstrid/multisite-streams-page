/*
Settings are in local storage.
*/



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
    
    $container: null,
    
    show: function(saveCallback, cancelCallback) {
        
        var saveFunction = function(){
            Settings.fieldsToStorage();
            saveCallback();
        };
        var cancelFunction = function(){
            // Revert any changes the user might've made
            Settings.storageToFields();
            cancelCallback();
        };
        
        Settings.$container.dialog({
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
            width: 500,
            height: 500
        });
    },
    
    
    /* Local storage <--> settings fields */
    
    hasStorage: function() {
        return (localStorage.length > 0);
    },
    storageToFields: function() {
        // Go through each setting in the fields.
        // If storage covers it, use the value from storage.
        // If storage doesn't cover it (probably a newly added setting
        // since the user's last visit), set the default value, AND
        // update storage with that setting as well.
        var $fieldElmts = Settings.$container.find('input, select');
        var storageNeedsUpdate = false;
        $fieldElmts.each(function(i, field) {
            var sName = $(field).attr('name');
            if (localStorage.hasOwnProperty(sName)) {
                Settings.setInFields(sName, localStorage[sName]);
            }
            else {
                Settings.setInFields(sName, Settings.defaults[sName]);
                storageNeedsUpdate = true;
            }
        })
        if (storageNeedsUpdate) {
            Settings.fieldsToStorage();
        }
    },
    fieldsToStorage: function() {
        var $fieldElmts = Settings.$container.find('input, select');
        
        $fieldElmts.each(function(i, field) {
            var settingName = $(field).attr('name');
            var settingValue = Settings.get(settingName);
            localStorage[settingName] = settingValue;
        });
    },
    
    
    /* Settings fields <--> settings as JS values */
    
    get: function(name) {
        var $fieldElmt = Settings.$container.find(
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
    setInFields: function(name, value) {
        var $fieldElmt = Settings.$container.find(
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
    
    
    fillFieldsWithDefaults: function() {
        // Fill the settings fields with default values
        for (settingName in Settings.defaults) {
            if (!Settings.defaults.hasOwnProperty(settingName)) {continue;}
            Settings.setInFields(settingName, Settings.defaults[settingName]);
        }
    },
    
    
    init: function() {
        // Get the container element which has all the settings
        Settings.$container = $('#settings');
        // Initialize the tabbed layout of the settings 
        Settings.$container.tabs();
    }
    
};
