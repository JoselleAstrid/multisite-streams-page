multisite-streams-page
======================

A single webpage showing the live streams and videos of channels you follow. Supports multiple sites - currently Twitch, Hitbox, Nicovideo, and Cavetube.

The main motivation for this page was to help people expand their stream watching from Twitch to other streaming sites such as Hitbox. If your preferred way to check Twitch streams is with a following page, and you want to expand your watching to Hitbox, then you would also have to check your Hitbox following page regularly; and since there are much fewer streamers on Hitbox, it's easy to get lazy about checking there. By using this single page to check multiple stream sites, you can devote equal attention to both Twitch and Hitbox streams - and any other site that's supported here.

In addition to the multi-site support, there are a few features that you don't normally get on a Twitch/Hitbox following page, such as alternate stream sorting methods (e.g. lowest view count first, shortest uptime first) and grouping Twitch hosts who are hosting the same channel.


Hosting status
--------------

Now hosted by Nmaster64 at http://speedruntools.com/following/, and not seeking an alternate host at this time.

But feel free to test the page on your local machine (see "How to host the page" below) for educational purposes.


How it works
------------

The page uses the Twitch, Hitbox, Nicovideo, and Cavetube APIs to get the streams and videos.

The Twitch part uses OAuth2. So if you are using the page for the first time, or if you are logging in, you will be redirected to a Twitch page asking if you will authorize the multi-site streams page to use your account. The "will have access to:" list should be empty, because the page only requests the basic `user_read` scope (to get your followed channels' streams and videos).

The Hitbox part doesn't use OAuth2 (because Hitbox doesn't support this yet), so it can't automatically figure out your Hitbox account even if you're logged into Hitbox. So you need to specify your Hitbox username in the Settings (button at the upper-right corner of the page).

The Nicovideo part also doesn't use OAuth2, and additionally it poses two other challenges:

* The Nicovideo API doesn't support CORS or JSONP access, which means a proxy server must be used to access the API via Javascript. The proxy server is Yahoo's YQL by default, but another proxy can be specified using `config.js` (described below).
* The Nicovideo API doesn't provide a way to directly get your followed streams and videos, especially since the use of a proxy server means doing authenticated requests is impossible. For live streams, the best we can do is request all live streams on the site (filtered by certain keywords) and then pick out the stream communities you follow (which you specify in Settings). This can be slow depending on the keywords used (configurable in Settings) and the amount of streaming activity on Nicovideo. Videos aren't supported yet, but those will also be a challenge.

The Cavetube part is similar to Nicovideo, involving using a proxy server and getting all live streams. However, the number of live streams is much smaller, so retrieving streams doesn't take as long as it does for Nicovideo.

The only code plugins used are jQuery, and jQuery UI (for the settings dialog). The Settings are saved with localStorage.


How to host the page
--------------------

Go to your Settings on twitch.tv, click the "Connections" tab, and then under "Developer Applications", register a new application. Enter a name for the application, and enter the exact URI where you intend to serve the page (this should be whatever is in the user's address bar when they load this page).

Download the `site` subdirectory from this repository (either with a `git clone`, or just download here from GitHub if you don't plan on keeping up to date regularly).

Add one file to your downloaded `site` subdirectory, called `config.js`. The contents should look like the following:

```
Config = {
    clientId: "yourclientidhere",
    proxyRequestServer: "yourproxyserverhere"
};
```
Replace `yourclientidhere` with the "Client ID" of the Developer Application you registered with Twitch.

Replace `yourproxyserverhere` with the proxy server you'll use to handle Nicovideo and Cavetube requests. For example, if you use https://www.npmjs.com/package/cors-anywhere to run your own Node.js-powered proxy server, this will be `http://127.0.0.1:8080/` if you use the default IP and port. Your chosen proxy server must work by simply appending the request URL to a base URL (which is the proxyRequestServer value), and must return the request as-is instead of wrapping it (unlike YQL). If you are fine with using Yahoo's YQL or you don't have another proxy server to use, then you can leave out the `proxyRequestServer` line altogether (and don't forget to remove the comma to keep proper Javascript syntax).

Then serve the `site` subdirectory in a webserver.

Here's a simple way to test the page on your local machine with Python: open a command prompt in the `site` subdirectory, and then enter `python -m http.server` (or `python -m SimpleHTTPServer` for Python 2.x). Then use an internet browser to navigate to the index page on your default local-server IP and port, e.g. `127.0.0.1:8000/index.html`.


Acknowledgments
----------------

Thanks to:

Hitakashi, for guiding me to the right API calls to use for Twitch and especially Hitbox.

Cronikeys, for making http://speedrun.tv/nico, demonstrating the most workable avenue for getting Nicovideo streams at this time of writing.
