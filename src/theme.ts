import { createTheme, type MantineColorsTuple } from '@mantine/core'

/** The app's navy (#14213D) and orange (#F77F00). */
const navy: MantineColorsTuple = [
  '#eef1f7',
  '#d9deea',
  '#b1bbd3',
  '#8796bc',
  '#6577a8',
  '#4f649c',
  '#435a97',
  '#344a84',
  '#2b4176',
  '#14213d',
]

const orange: MantineColorsTuple = [
  '#fff4e8',
  '#ffe7d1',
  '#ffcda0',
  '#ffb16a',
  '#ff993d',
  '#ff8a20',
  '#f77f00',
  '#de7000',
  '#c66300',
  '#ad5400',
]

export const theme = createTheme({
  primaryColor: 'navy',
  primaryShade: { light: 9, dark: 4 },
  colors: { navy, orange },
  fontFamily: 'Cairo, system-ui, sans-serif',
  headings: { fontFamily: 'Cairo, system-ui, sans-serif' },
  defaultRadius: 'md',
})
