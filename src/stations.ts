/** A station on the wheel. */
export interface Station {
  /** Folder under the station files, e.g. radio_02_pop. Also names the logo file. */
  id: string
  name: string
  genre: string
}

/** Shows the debug panel when VITE_DEBUG is "true". */
export const DEBUG = import.meta.env.VITE_DEBUG === 'true'

/**
 * Where the station files live (radio.json, <id>/station.json and the audio), with a trailing
 * slash. By default `stations/` next to the page, so the whole app is static files.
 */
export const STATIONS_URL = (import.meta.env.VITE_STATIONS_URL || 'stations/').replace(/\/*$/, '/')

/** Stations on the wheel, in the order the game lists them (by id). */
export const STATIONS: Station[] = [
  ['radio_01_class_rock', 'Los Santos Rock Radio', 'Classic rock, soft rock, pop rock'],
  ['radio_02_pop', 'Non-Stop-Pop FM', 'Pop'],
  ['radio_03_hiphop_new', 'Radio Los Santos', 'Modern contemporary hip hop, trap'],
  ['radio_04_punk', 'Channel X', 'Punk rock, hardcore punk and grunge'],
  ['radio_05_talk_01', 'West Coast Talk Radio', 'Public Talk Radio'],
  ['radio_06_country', 'Rebel Radio', 'Country music and rockabilly'],
  ['radio_07_dance_01', 'Soulwax FM', 'Electronic music'],
  ['radio_08_mexican', 'East Los FM', 'Mexican music and Latin music'],
  ['radio_09_hiphop_old', 'West Coast Classics', 'Golden age hip hop and gangsta rap'],
  ['radio_11_talk_02', 'Blaine County Talk Radio', 'Public Talk Radio'],
  ['radio_12_reggae', 'Blue Ark', 'Reggae, dancehall and dub'],
  ['radio_13_jazz', 'Worldwide FM', 'Lounge, chillwave, jazz-funk and world'],
  ['radio_14_dance_02', 'FlyLo FM', 'IDM and Midwest hip hop'],
  ['radio_15_motown', 'The Lowdown 91.1', 'Classic soul, disco, gospel'],
  ['radio_16_silverlake', 'Radio Mirror Park', 'Indie pop, synthpop, indietronica and chillwave'],
  ['radio_17_funk', 'Space 103.2', 'Funk and R&B'],
  ['radio_18_90s_rock', 'Vinewood Boulevard Radio', 'Garage rock, alternative rock and noise rock'],
  ['radio_20_thelab', 'The Lab', 'Hip hop'],
  ['radio_21_dlc_xm17', 'Blonded Radio', 'Alternative R&B'],
  ['radio_22_dlc_battle_mix1_radio', 'Los Santos Underground Radio', 'House, techno and electronic'],
  ['radio_27_dlc_prhei4', 'Still Slipping Los Santos', 'Electronic, house and techno'],
  ['radio_34_dlc_hei4_kult', 'Kult FM', 'Experimental rock, underground pop'],
].map(([id, name, genre]) => ({ id, name, genre }))

/** A file's URL under the station files. */
export function fileUrl(file: string) {
  return STATIONS_URL + file.split('/').map(encodeURIComponent).join('/')
}
