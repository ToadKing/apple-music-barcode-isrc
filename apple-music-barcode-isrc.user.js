// ==UserScript==
// @name        Apple Music Barcodes/ISRCs
// @namespace   applemusic.barcode.isrc
// @description Get Barcodes/ISRCs/etc. from Apple Music pages
// @version     0.7
// @grant       none
// @include     https://music.apple.com/*
// @grant       none
// @run-at      document-idle
// ==/UserScript==

function addSimple(content, node, parent) {
  const elem = document.createElement(node)
  elem.textContent = content
  elem.style.userSelect = 'text'
  parent.appendChild(elem)
  return elem
}

function getDatums() {
  try {
    const music_info = JSON.parse(document.getElementById('shoebox-media-api-cache-amp-music').innerHTML)

    const albums = []

    for (const [key, value] of Object.entries(music_info).filter(([key]) => key.startsWith('\uF8FF.catalog.'))) {
      const albumsData = JSON.parse(value)

      for (const albumData of albumsData.d.filter((item) => item.type === 'albums')) {
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
      addSimple(`Release Date: ${album.releaseDate}`, 'p', results)
      addSimple(`Label: ${album.label}`, 'p', results)
      addSimple(`Barcode: ${album.barcode}`, 'p', results)
      addSimple(`Mastered for iTunes: ${album.isMasteredForItunes}`, 'p', results)
      addSimple(`Audio: ${album.audio}`, 'p', results)
      addSimple(`Copyright: ${album.copyright}`, 'p', results)

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
