import { Anchor, Box, Stack, Text } from '@mantine/core'

type Point = { lat: number; lng: number }

/**
 * Where the shop put itself, so a moderator can check it before approving:
 * Google's map with a pin (when a key is set) and a link to open it there.
 */
export function ShopMap({ location, name }: { location: Point | null; name: string }) {
  if (!location) {
    return (
      <Text size="sm" c="dimmed">
        المحل لسه محددش مكانه على الخريطة.
      </Text>
    )
  }
  // The Maps Embed key; Google only accepts it from the dashboard's own sites.
  const key = (import.meta.env.VITE_MAPS_EMBED_KEY as string | undefined) || ''
  const point = `${location.lat},${location.lng}`
  const embed = `https://www.google.com/maps/embed/v1/place?${new URLSearchParams({
    key,
    q: point,
    zoom: '16',
    language: 'ar',
  })}`
  return (
    <Stack gap={6}>
      {key && (
        <Box
          component="iframe"
          title={`مكان ${name} على الخريطة`}
          src={embed}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          h={240}
          w="100%"
          style={{ border: 0, borderRadius: 8 }}
        />
      )}
      <Anchor
        href={`https://www.google.com/maps/search/?api=1&query=${point}`}
        target="_blank"
        rel="noreferrer"
        size="sm"
      >
        افتح على Google Maps
      </Anchor>
    </Stack>
  )
}
