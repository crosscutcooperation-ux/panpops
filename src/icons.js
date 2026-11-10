const paths = {
  cart: 'M2 3h3l3 13h11l3-9H6m3 13h.01m9 0h.01',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  check: 'm5 12 4 4L20 5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  bag: 'M5 8h14l1 13H4L5 8Zm4 2V6a3 3 0 0 1 6 0v4',
  spin: 'M20 11a8 8 0 1 0-2 6m2-11v5h-5',
  spark: 'm12 2 2 7 7 3-7 2-2 8-2-8-8-2 8-3 2-7Z',
  close: 'm6 6 12 12M6 18 18 6',
}
export const icon = name => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="' + paths[name] + '"/></svg>'
