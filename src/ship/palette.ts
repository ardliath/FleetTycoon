/**
 * CalMac-inspired livery palette, sampled from the reference photos.
 * Every renderer (side view, top view, future Phaser sprites) uses these
 * so the whole fleet stays visually coherent.
 */
export const LIVERY = {
  hull: '#151a21', // near-black navy
  hullShade: '#0d1117',
  boot: '#8f2b25', // red antifouling peeking below the waterline
  white: '#f2f4f3', // superstructure
  whiteShade: '#d8dedd', // deck insets / shadow faces
  deckShadow: 'rgba(10, 14, 18, 0.28)',
  funnelRed: '#d92818',
  funnelRedShade: '#b21f10',
  funnelBlack: '#1a1d20',
  discYellow: '#f0b429',
  lionRed: '#c8102e',
  deckGreen: '#3d7457', // painted steel decks, seen from above
  deckGreenShade: '#33624a',
  mastBuff: '#c9a15c',
  lifeboatOrange: '#e8641f',
  lifeboatCanopy: '#f4f0e6',
  window: '#33424e',
  glazing: '#22303a',
  porthole: '#c3ced4',
  deckGrey: '#3a4249',
  deckLine: 'rgba(242, 244, 243, 0.35)',
  laneMark: 'rgba(242, 244, 243, 0.55)',
  sea: '#c9dce8',
  seaDeep: '#b4cdde',
  text: '#f2f4f3',
  redText: '#d92818',
} as const
