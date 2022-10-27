# Apple Music Barcodes/ISRCs

Allows reading barcodes, ISRCs, and other metadata from Apple Music releases. Click the green sqaure in the upper-left corner of the page to display album metadata.

Some notes about the script:
* It uses a hardcoded access token for Apple's music server. It's possible this can change at any time, and if it does the script will need to be updated for it. The quickest way to alert me of this is to make an issue on this repo.
* I've ran into a couple of times during testing where I get locked out of the site for making too many requests. This appears as an infinite loading screen on the site. If that happens you have to wait a couple of minutes before you can access the site again.

Tested with Violentmonkey in Firefox but should also work in Chrome.

## Installing

Install [the script](https://github.com/ToadKing/apple-music-barcode-isrc/raw/master/apple-music-barcode-isrc.user.js) using your prefered userscript manager.
