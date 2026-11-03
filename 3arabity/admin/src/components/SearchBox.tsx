import { TextInput } from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconSearch } from '@tabler/icons-react'
import { useState } from 'react'

/** A search field that sends what was typed after a short pause. */
export function SearchBox({
  value,
  onSearch,
  placeholder,
}: {
  value: string
  onSearch(value: string): void
  placeholder: string
}) {
  const [text, setText] = useState(value)
  const [sent, setSent] = useState(value)
  // Back and forward change the address, and with it the words.
  if (value !== sent) {
    setSent(value)
    setText(value)
  }
  const send = useDebouncedCallback((words: string) => {
    setSent(words)
    onSearch(words)
  }, 350)
  return (
    <TextInput
      leftSection={<IconSearch size={16} />}
      placeholder={placeholder}
      value={text}
      onChange={(event) => {
        setText(event.currentTarget.value)
        send(event.currentTarget.value)
      }}
      w={{ base: '100%', xs: 280 }}
    />
  )
}
