export const THEME_COLORS = [
  {
    name: 'deep blue',
    hexcode: '#121358',
    alias: 'brand_color',
  },
  {
    name: 'soft blue',
    hexcode: '#B5BAFF',
    alias: 'label_font',
  },
  {
    name: 'medium blue',
    hexcode: '#9FA1FF',
    alias: 'card_color',
  },
  {
    name: 'red pink',
    hexcode: '#FCB7C7',
    alias: 'expense_color',
  },
  {
    name: 'light green',
    hexcode: '#D9F9DF',
    alias: 'income_color',
  },
] as const

export type ThemeAlias = typeof THEME_COLORS[number]['alias']

export const color = (alias: ThemeAlias): string =>
  THEME_COLORS.find(c => c.alias === alias)!.hexcode
