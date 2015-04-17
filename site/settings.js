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
    
    $form: null,
    
    show: function(saveCallback, cancelCallback) {
        
        var saveFunction = function(){
            Settings.formToStorage();
            saveCallback();
        }
        var cancelFunction = function(){
            // Revert any changes the user might've made
            Settings.storageToForm();
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
    
    
    /* Local storage <--> settings form */
    
    hasStorage: function() {
        return (localStorage.length > 0);
    },
    storageToForm: function() {
        // Go through each setting in the form.
        // If storage covers it, use the value from storage.
        // If storage doesn't cover it (probably a newly added setting
        // since the user's last visit), set the default value, AND
        // update storage with that setting as well.
        var $fieldElmts = Settings.$form.find('input, select');
        var storageNeedsUpdate = false;
        $fieldElmts.each(function(i, field) {
            var settingName = $(field).attr('name');
            if (localStorage.hasOwnProperty(settingName)) {
                Settings.setInForm(settingName, localStorage[settingName]);
            }
            else {
                Settings.setInForm(settingName, Settings.defaults[settingName]);
                storageNeedsUpdate = true;
            }
        })
        if (storageNeedsUpdate) {
            Settings.formToStorage();
        }
    },
    formToStorage: function() {
        var $fieldElmts = Settings.$form.find('input, select');
        
        $fieldElmts.each(function(i, field) {
            var settingName = $(field).attr('name');
            var settingValue = Settings.get(settingName);
            localStorage[settingName] = settingValue;
        });
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
