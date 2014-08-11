multisite-streams-page
======================

A single webpage showing the live streams and videos of channels you follow, from multiple sites (currently Twitch and Hitbox).


Screenshots
-----------

In this Imgur album: http://imgur.com/a/XeE7I


How it works
------------

The page uses the Twitch and Hitbox APIs to get the streams and videos.

The Twitch part uses OAuth2. So if you are using the page for the first time, or if you are logging in, you will be redirected to a Twitch page asking if you will authorize the multi-site streams page to use your account. The "will have access to:" list should be empty, because the page only requests the basic `user_read` scope (to get your followed channels' streams and videos).

The Hitbox part doesn't use OAuth2 (because Hitbox doesn't support this yet), so it can't automatically figure out your Hitbox account even if you're logged into Hitbox. Instead, this page has a Settings form where you need to specify your Hitbox username.

The Settings form allows you to specify your Hitbox username, turn Twitch and Hitbox listings on/off, and change how many streams you load from each site. Later, there may be more settings for customizing the page look and/or layout. Page settings are saved using a cookie.

The page code is nothing fancy. The only plugins used are jQuery, and jQuery UI (for the settings dialog).


How to host the page
--------------------

Go to your Settings on twitch.tv, click the "Connections" tab, and then under "Developer Applications", register a new application. Enter a name for the application, and enter the exact URI where you intend to serve the page (this should be whatever is in the user's address bar when they load this page).

Download the `site` subdirectory from this repository (either with a `git clone`, or just download here from GitHub if you don't plan on keeping up to date regularly).

Add one file to your downloaded `site` subdirectory, called `config.js`. The contents should be the following:

```
Config = {
    clientId: "yourclientidhere"
};
```
Replace `yourclientidhere` with the "Client ID" of the Developer Application you registered with Twitch.

Then serve the `site` subdirectory in a webserver. This is easy to test on your local machine if you have Python - open a command prompt in the `site` subdirectory, and then use one of the commands here: http://stackoverflow.com/a/532710


Acknowledgments
----------------

Thanks to Hitakashi for guiding me to the right API calls to use, especially for Hitbox.
