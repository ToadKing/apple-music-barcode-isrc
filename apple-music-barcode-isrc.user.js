// ==UserScript==
// @name        Apple Music Barcodes/ISRCs
// @namespace   applemusic.barcode.isrc
// @description Get Barcodes/ISRCs/etc. from Apple Music pages
// @version     0.13
// @grant       none
// @include     https://music.apple.com/*
// @grant       none
// @run-at      document-idle
// @grant       GM_xmlhttpRequest
// ==/UserScript==

// TODO: try to find this token programmatically? It's hardcoded into scripts now so maybe not practical.
const token = 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IldlYlBsYXlLaWQifQ.eyJpc3MiOiJBTVBXZWJQbGF5IiwiaWF0IjoxNjY2MjA5MTY4LCJleHAiOjE2NzM0NjY3NjgsInJvb3RfaHR0cHNfb3JpZ2luIjpbImFwcGxlLmNvbSJdfQ.txDAv_8oy4G8zaens4enLYtADkP_zwcVLfT4NKW9l6Bt9KEyaYj566gtchMPJ-5cj7xxxrFsbd6wJcPbNvBRCg'
const baseURL = 'https://amp-api.music.apple.com/v1'

// Needs to use GM_xmlhttpRequest
// 1. we need to set the origin header to any value, which you normally cannot do with fetch, because
// 2. we may be running in the content script context instead of the page one if we're in Firefox
function asyncGM_xmlhttpRequest(req) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      ...req,
      onload(e) { resolve(e.response) },
      onerror(e) { reject(e) },
    })
  })
}

function addSimple(content, node, parent) {
  const elem = document.createElement(node)
  elem.textContent = content
  elem.style.userSelect = 'text'
  parent.appendChild(elem)
  return elem
}

async function getDatums() {
  try {
    const results = addSimple('Loading, press ESC to close...', 'div', document.body)
    results.style.position = 'absolute'
    results.style.inset = '30px'
    results.style.zIndex = 2147483647
    results.style.background = 'white'
    results.style.color = 'black'
    results.style.overflow = 'auto'
    results.style.padding = '4px'

    const close = () => {
      document.body.removeEventListener('keydown', close)
      results.remove()
    }
    document.body.addEventListener('keydown', (e) => { if (e.key === 'Escape') close() })

    const albumId = document.location.pathname.split('/').reverse().find(p => /^\d+$/.test(p))
    const country = document.location.pathname.split('/')[1]
    const url = `${baseURL}/catalog/${country}/albums/${albumId}`

    const res = await asyncGM_xmlhttpRequest({ url, method: 'GET', mode: 'cors', credentials: 'include', headers: { Authorization: `Bearer ${token}`, Origin: new URL(baseURL).origin } })
    const resJson = JSON.parse(res)
    const albumsData = resJson.data

    const albums = []

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

    if (albums.length === 0) {
      close()
      throw new Error('no albums found')
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
      addSimple(`Label: ${album.label}`, 'p', results)
      addSimple(`Barcode: ${album.barcode}`, 'p', results)
      addSimple(`Mastered for iTunes: ${album.isMasteredForItunes}`, 'p', results)
      addSimple(`Audio: ${album.audio}`, 'p', results)
      addSimple(`Copyright: ${album.copyright}`, 'p', results)
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
      const t4 = addSimple('Composer', 'td', tr)
      t4.style.background = 'white'
      t4.style.position = 'sticky'
      t4.style.top = 0
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
        addSimple(track.composer, 'td', tr)
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
