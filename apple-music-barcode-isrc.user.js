// ==UserScript==
// @name        Apple Music Barcodes/ISRCs
// @namespace   applemusic.barcode.isrc
// @description Get Barcodes/ISRCs/etc. from Apple Music pages
// @version     0.1
// @grant       none
// @include     https://music.apple.com/*
// @grant       none
// @run-at      document-start
// ==/UserScript==

function addSimple(content, node, parent) {
  const elem = document.createElement(node)
  elem.textContent = content
  elem.style.userSelect = 'text'
  parent.appendChild(elem)
  return elem
}

let music_info

try {
	music_info = JSON.parse(document.getElementById('shoebox-media-api-cache-amp-music').innerHTML)
} catch(e) {
	console.log('shoebox-media-api-cache-amp-music not found', e)
}

function getDatums() {
  try {
    const albums = []

    for (const [key, value] of Object.entries(music_info).filter(([key]) => key.startsWith('\uF8FF.catalog.'))) {
      const albumsData = JSON.parse(value)

      for (const albumData of albumsData.d.filter((item) => item.type === 'albums')) {
        const album = {
          name: albumData.attributes.name,
          artist: albumData.attributes.artistName,
          barcode: albumData.attributes.upc,
          tracks: [],
        }

        if (albumData.relationships.tracks) {
          for (const track_data of albumData.relationships.tracks.data) {
            const track = {
              name: track_data.attributes.name,
              artist: track_data.attributes.artistName,
              composer: track_data.attributes.composerName,
              disc: track_data.attributes.discNumber,
              track: track_data.attributes.trackNumber,
              isrc: track_data.attributes.isrc,
            }

            album.tracks.push(track)
          }
        }

        albums.push(album)
      }
    }

    if (albums.length === 0) {
      throw new Error('no albums found')
    }

    const results = addSimple('', 'div', document.body)
    results.style.position = 'absolute'
    results.style.inset = '30px'
    results.style.zIndex = 2147483647
    results.style.background = 'white'
    results.style.color = 'black'
    results.style.overflow = 'auto'
    results.style.padding = '4px'

    for (const album of albums) {
      addSimple(album.name, 'h1', results)
      addSimple(album.artist, 'h2', results)
      addSimple(`Barcoode: ${album.barcode}`, 'p', results)

      const hasMultipleDiscs = album.tracks.some(t => t.disc !== 1)

      const table = addSimple('', 'table', results)
      table.style.width = '100%'
      table.style.borderCollapse = 'separate'
      table.style.borderSpacing = '2px'
      table.setAttribute('border', '1')
      const thead = addSimple('', 'thead', table)
      thead.style.position = 'sticky'
      thead.style.top = 0
      thead.style.background = 'white'
      thead.style.fontWeight = 'bold'
      const tr = addSimple('', 'tr', thead)
      addSimple('Track', 'td', tr)
      addSimple('Title', 'td', tr)
      addSimple('Artist', 'td', tr)
      addSimple('Composer', 'td', tr)
      addSimple('ISRC', 'td', tr)

      const tbody = addSimple('', 'tbody', table)
      for (const track of album.tracks) {
        const tr = addSimple('', 'tr', tbody)
        addSimple(hasMultipleDiscs ? `${track.disc}.${track.track}` : track.track, 'td', tr)
        addSimple(track.name, 'td', tr)
        addSimple(track.artist, 'td', tr)
        addSimple(track.composer, 'td', tr)
        addSimple(track.isrc, 'td', tr)
      }
    }

    const close = (e) => {
      if (e.key === 'Escape') {
        document.body.removeEventListener('keydown', close)
        results.remove()
      }
    }
    document.body.addEventListener('keydown', close)
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
