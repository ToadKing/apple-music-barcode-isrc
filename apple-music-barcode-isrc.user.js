// ==UserScript==
// @name          Apple Music Barcodes/ISRCs
// @namespace     applemusic.barcode.isrc
// @description   Get Barcodes/ISRCs/etc. from Apple Music pages
// @version       0.21
// @match         https://music.apple.com/*
// @exclude-match https://music.apple.com/includes/commerce/fetch-proxy.html
// @run-at        document-idle
// @grant         GM_xmlhttpRequest
// ==/UserScript==

(async () => {
// for userscript managers that don't support @exclude-match
if (document.location.pathname === '/includes/commerce/fetch-proxy.html') {
  return
}

// Needs to attempt to use GM_xmlhttpRequest
// 1. we need to set the origin header to any value, which you normally cannot do with fetch, because
// 2. we may be running in the content script context instead of the page one if we're in Firefox
async function fetchWrapper(url, options) {
  if (window.GM_xmlhttpRequest) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        ...options,
        url,
        onload(e) { resolve(e.response) },
        onerror(e) { reject(e) },
      })
    })
  } else {
    const res = await fetch(url, options)
    return await res.text()
  }
}

// Very hacky way to find the token automatically when it changes
let scriptToken
try {
  const configScript = document.querySelector('script[crossorigin]')
  const scriptSrc = await fetchWrapper(configScript.src)
  scriptToken = scriptSrc.match(/("|')(ey.*?)\1/)[2]
} catch(e) {
  alert(`error getting apple music token: ${e}`)
}

const token = scriptToken
const baseURL = 'https://amp-api.music.apple.com/v1'

function addSimple(content, node, parent) {
  const elem = document.createElement(node)
  elem.textContent = content
  elem.style.userSelect = 'text'
  parent.appendChild(elem)
  return elem
}

async function getDatums() {
  let results

  const close = () => {
    document.body.removeEventListener('keydown', escListener)
    results.remove()
  }

  const escListener = (e) => {
    if (e.key === 'Escape') {
      close()
    }
  }

  try {
    results = addSimple('Loading, press ESC to close...', 'div', document.body)
    results.style.position = 'absolute'
    results.style.inset = '30px'
    results.style.zIndex = 2147483647
    results.style.background = 'white'
    results.style.color = 'black'
    results.style.overflow = 'auto'
    results.style.padding = '4px'

    document.body.addEventListener('keydown', escListener)

    const albumId = document.location.pathname.split('/').reverse().find(p => /^\d+$/.test(p))
    const country = document.location.pathname.split('/')[1]
    const entryType = document.location.pathname.split('/')[2]
    const url = `${baseURL}/catalog/${country}/${entryType}s/${albumId}`

    const res = await fetchWrapper(url, { method: 'GET', mode: 'cors', credentials: 'include', headers: { Authorization: `Bearer ${token}`, Origin: new URL(baseURL).origin } })
    const resJson = JSON.parse(res)
    const albumsData = resJson.data

    const albums = []

    // albums
    for (const albumData of albumsData.filter((item) => item.type === 'albums')) {
      const album = {
        name: albumData.attributes.name,
        artist: albumData.attributes.artistName,
        releaseDate: albumData.attributes.releaseDate,
        label: albumData.attributes.recordLabel,
        barcode: albumData.attributes.upc,
        isMasteredForItunes: albumData.attributes.isMasteredForItunes,
        audio: albumData.attributes.audioTraits,
        copyright: albumData.attributes.copyright,
        tracks: [],
        differentDates: false,
      }

      if (albumData.relationships.tracks) {
        let tracksHaveDates = false
        for (const track_data of albumData.relationships.tracks.data) {
          const track = {
            name: track_data.attributes.name,
            artist: track_data.attributes.artistName,
            composer: track_data.attributes.composerName,
            disc: track_data.attributes.discNumber,
            track: track_data.attributes.trackNumber,
            isrc: track_data.attributes.isrc,
            releaseDate: track_data.attributes.releaseDate,
          }

          if (track.releaseDate !== album.releaseDate) {
            album.differentDates = true
          }

          if (!!track_data.attributes.releaseDate) {
            tracksHaveDates = true
          }

          album.tracks.push(track)
        }

        if (!tracksHaveDates) {
          // no tracks have release dates, unset the different dates flag
          album.differentDates = false
        }
      }

      albums.push(album)
    }

    // music videos
    for (const videoData of albumsData.filter((item) => item.type === 'music-videos')) {
      const album = {
        name: videoData.attributes.name,
        artist: videoData.attributes.artistName,
        releaseDate: videoData.attributes.releaseDate,
        tracks: [{
          name: videoData.attributes.name,
          artist: videoData.attributes.artistName,
          disc: 1,
          track: 1,
          isrc: videoData.attributes.isrc,
          releaseDate: videoData.attributes.releaseDate,
        }],
        differentDates: false,
      }

      albums.push(album)
    }

    if (albums.length === 0) {
      throw new Error('no albums or music videos found')
    }

    results.textContent = ''

    for (const album of albums) {
      addSimple(album.name, 'h1', results)
      addSimple(album.artist, 'h2', results)
      const albumDate = addSimple(`Release Date: ${album.releaseDate}`, 'p', results)
      if (album.differentDates) {
        albumDate.appendChild(document.createTextNode(' '))
        const bold = document.createElement('b')
        bold.style.color = '#c00'
        bold.textContent = '(Some track dates differ)'
        albumDate.appendChild(bold)
      }
      if (album.label !== undefined) {
        addSimple(`Label: ${album.label}`, 'p', results)
      }
      if (album.barcode !== undefined) {
        addSimple(`Barcode: ${album.barcode}`, 'p', results)
      }
      if (album.isMasteredForItunes !== undefined) {
        addSimple(`Mastered for iTunes: ${album.isMasteredForItunes}`, 'p', results)
      }
      if (album.audio !== undefined) {
        addSimple(`Audio: ${album.audio}`, 'p', results)
      }
      if (album.copyright !== undefined) {
        addSimple(`Copyright: ${album.copyright}`, 'p', results)
      }
      const kepstinContainer = addSimple('', 'p', results)
      const kepstinLink = addSimple('Submit to kepstin’s MagicISRC', 'a', kepstinContainer)
      kepstinLink.target = '_blank'
      // we intentionally don't use the `isrcM-T` format due to differences in how Apple Music formats some track lists
      kepstinLink.href = 'https://magicisrc.kepstin.ca/?' + album.tracks.map((track, i) => `isrc${i+1}=${track.isrc}`).join('&')
      kepstinLink.style.color = '#06c'
      kepstinLink.style.textDecoration = 'underline'
      // work around Apple Music's handling of links
      kepstinLink.addEventListener('click', e => {
        e.preventDefault()
        e.stopPropagation()
        window.open(e.target.href, e.target.target)
      })

      const hasMultipleDiscs = album.tracks.some(t => t.disc !== 1)
      const hasComposers = album.tracks.some(t => t.composer !== undefined)

      const table = addSimple('', 'table', results)
      table.style.width = '100%'
      table.style.borderCollapse = 'separate'
      table.style.borderSpacing = '2px'
      table.setAttribute('border', '1')
      const thead = addSimple('', 'thead', table)
      thead.style.fontWeight = 'bold'
      const tr = addSimple('', 'tr', thead)
      const t1 = addSimple('Track', 'td', tr)
      t1.style.background = 'white'
      t1.style.position = 'sticky'
      t1.style.top = 0
      const t2 = addSimple('Title', 'td', tr)
      t2.style.background = 'white'
      t2.style.position = 'sticky'
      t2.style.top = 0
      const t3 = addSimple('Artist', 'td', tr)
      t3.style.background = 'white'
      t3.style.position = 'sticky'
      t3.style.top = 0
      if (hasComposers) {
        const t4 = addSimple('Composer', 'td', tr)
        t4.style.background = 'white'
        t4.style.position = 'sticky'
        t4.style.top = 0
      }
      const t5 = addSimple('ISRC', 'td', tr)
      t5.style.background = 'white'
      t5.style.position = 'sticky'
      t5.style.top = 0

      if (album.differentDates) {
        const t6 = addSimple('Date', 'td', tr)
        t6.style.background = 'white'
        t6.style.position = 'sticky'
        t6.style.top = 0
      }

      const tbody = addSimple('', 'tbody', table)
      for (const track of album.tracks) {
        const tr = addSimple('', 'tr', tbody)
        addSimple(hasMultipleDiscs ? `${track.disc}.${track.track}` : track.track, 'td', tr)
        addSimple(track.name, 'td', tr)
        addSimple(track.artist, 'td', tr)
        if (hasComposers) {
          addSimple(track.composer, 'td', tr)
        }
        addSimple(track.isrc, 'td', tr)
        if (album.differentDates) {
          const trackDate = addSimple(track.releaseDate, 'td', tr)
          if (track.releaseDate !== album.releaseDate) {
            trackDate.style.fontWeight = 'bold'
            trackDate.style.color = '#c00'
          }
        }
      }
    }

    addSimple('Press ESC to close', 'p', results)
  } catch (e) {
    alert(e)
    close()
  }
}

const clickMe = addSimple('', 'div', document.body)
clickMe.style.position = 'absolute'
clickMe.style.width = '15px'
clickMe.style.height = '15px'
clickMe.style.top = 0
clickMe.style.left = 0
clickMe.style.background = 'green'
clickMe.style.cursor = 'pointer'
clickMe.style.zIndex = 2147483647
clickMe.addEventListener('click', getDatums)

})()
