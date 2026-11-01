import {
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { Navigate } from 'react-router'

import { api, ApiError } from '../api/client'
import type { CarBrand, CarModel, CarsSettings } from '../api/types'
import { useSession } from '../auth/session'
import { QueryState } from '../components/common'
import { useAfterChange, useApi } from '../hooks'
import { formatDateTime } from '../labels'

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'حصل خطأ، جرّب تاني')
const thisYear = new Date().getFullYear()

/** A code from the English name: `Grand Cherokee` → `grand-cherokee`. */
const codeOf = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

const newModel = (): CarModel => ({ id: '', nameAr: '', nameEn: '', fromYear: thisYear, toYear: null })

/** The whole list, edited here and saved in one go. */
function CarsEditor({ saved }: { saved: CarsSettings['cars'] }) {
  const afterChange = useAfterChange()
  const [brands, setBrands] = useState(saved.brands)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = JSON.stringify(brands) !== JSON.stringify(saved.brands)

  // Saved codes are what parts and users' cars keep, so they stay as they are.
  const savedBrand = (index: number) => saved.brands.some((brand) => brand.id === brands[index]?.id)
  const savedModel = (brand: CarBrand, model: CarModel) =>
    saved.brands.some((b) => b.id === brand.id && b.models.some((m) => m.id === model.id))

  const updateBrand = (index: number, change: Partial<CarBrand>) =>
    setBrands(brands.map((brand, i) => (i === index ? { ...brand, ...change } : brand)))
  const updateModel = (brandIndex: number, modelIndex: number, change: Partial<CarModel>) =>
    updateBrand(brandIndex, {
      models: brands[brandIndex]!.models.map((model, i) => (i === modelIndex ? { ...model, ...change } : model)),
    })

  const addBrand = () => {
    const key = `new-${Date.now()}`
    setBrands([...brands, { id: '', nameAr: '', nameEn: '', models: [newModel()], key } as CarBrand])
    setOpen(String(brands.length))
  }

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const body = {
        brands: brands.map(({ id, nameAr, nameEn, models }) => ({
          id: id || codeOf(nameEn),
          nameAr: nameAr.trim(),
          nameEn: nameEn.trim(),
          models: models.map((model) => ({
            ...model,
            id: model.id || codeOf(model.nameEn),
            nameAr: model.nameAr.trim(),
            nameEn: model.nameEn.trim(),
          })),
        })),
      }
      await api('/settings/cars', { method: 'PUT', body })
      await afterChange('اتحفظت العربيات، والتطبيق هيعرضها خلال دقايق')
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setBusy(false)
    }
  }

  const models = brands.reduce((sum, brand) => sum + brand.models.length, 0)

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        {brands.length} ماركة و{models} موديل.{' '}
        {saved.updatedAt ? `آخر تعديل ${formatDateTime(saved.updatedAt)}.` : 'دي القايمة اللي نزل بيها التطبيق.'}{' '}
        مينفعش تمسح ماركة أو موديل عليه إعلانات أو عربيات مستخدمين، بس تقدر تغيّر اسمه وسنينه.
      </Text>

      <Accordion variant="separated" value={open} onChange={setOpen}>
        {brands.map((brand, brandIndex) => (
          <Accordion.Item key={(brand as CarBrand & { key?: string }).key ?? brand.id} value={String(brandIndex)}>
            <Accordion.Control>
              <Group gap="xs">
                <Text fw={600}>{brand.nameAr || 'ماركة جديدة'}</Text>
                <Text size="sm" c="dimmed" dir="ltr">
                  {brand.nameEn}
                </Text>
                <Badge variant="light" size="sm">
                  {brand.models.length} موديل
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack>
                <Group align="flex-end">
                  <TextInput
                    label="الاسم بالعربي"
                    value={brand.nameAr}
                    onChange={(event) => updateBrand(brandIndex, { nameAr: event.currentTarget.value })}
                  />
                  <TextInput
                    label="الاسم بالإنجليزي"
                    dir="ltr"
                    value={brand.nameEn}
                    onChange={(event) => updateBrand(brandIndex, { nameEn: event.currentTarget.value })}
                  />
                  <TextInput
                    label="الكود"
                    dir="ltr"
                    w={150}
                    disabled={savedBrand(brandIndex)}
                    placeholder={codeOf(brand.nameEn)}
                    value={brand.id}
                    onChange={(event) => updateBrand(brandIndex, { id: event.currentTarget.value.toLowerCase() })}
                  />
                  <Tooltip label="امسح الماركة">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="lg"
                      onClick={() => {
                        setBrands(brands.filter((_, i) => i !== brandIndex))
                        setOpen(null)
                      }}
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>

                <Table.ScrollContainer minWidth={640}>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>بالعربي</Table.Th>
                        <Table.Th>بالإنجليزي</Table.Th>
                        <Table.Th>الكود</Table.Th>
                        <Table.Th>من سنة</Table.Th>
                        <Table.Th>لحد سنة</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {brand.models.map((model, modelIndex) => (
                        <Table.Tr key={modelIndex}>
                          <Table.Td>
                            <TextInput
                              aria-label="الموديل بالعربي"
                              value={model.nameAr}
                              onChange={(event) =>
                                updateModel(brandIndex, modelIndex, { nameAr: event.currentTarget.value })
                              }
                            />
                          </Table.Td>
                          <Table.Td>
                            <TextInput
                              aria-label="الموديل بالإنجليزي"
                              dir="ltr"
                              value={model.nameEn}
                              onChange={(event) =>
                                updateModel(brandIndex, modelIndex, { nameEn: event.currentTarget.value })
                              }
                            />
                          </Table.Td>
                          <Table.Td>
                            <TextInput
                              aria-label="كود الموديل"
                              dir="ltr"
                              w={120}
                              disabled={savedModel(brand, model)}
                              placeholder={codeOf(model.nameEn)}
                              value={model.id}
                              onChange={(event) =>
                                updateModel(brandIndex, modelIndex, { id: event.currentTarget.value.toLowerCase() })
                              }
                            />
                          </Table.Td>
                          <Table.Td>
                            <NumberInput
                              aria-label="من سنة"
                              w={90}
                              min={1930}
                              max={thisYear + 1}
                              hideControls
                              value={model.fromYear}
                              onChange={(value) =>
                                updateModel(brandIndex, modelIndex, { fromYear: Number(value) || thisYear })
                              }
                            />
                          </Table.Td>
                          <Table.Td>
                            <NumberInput
                              aria-label="لحد سنة"
                              w={90}
                              min={1930}
                              max={thisYear + 1}
                              hideControls
                              placeholder="لسه بيتعمل"
                              value={model.toYear ?? ''}
                              onChange={(value) =>
                                updateModel(brandIndex, modelIndex, { toYear: value === '' ? null : Number(value) })
                              }
                            />
                          </Table.Td>
                          <Table.Td>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label="امسح الموديل"
                              disabled={brand.models.length === 1}
                              onClick={() =>
                                updateBrand(brandIndex, {
                                  models: brand.models.filter((_, i) => i !== modelIndex),
                                })
                              }
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
                <Group>
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconPlus size={14} />}
                    onClick={() => updateBrand(brandIndex, { models: [...brand.models, newModel()] })}
                  >
                    ضيف موديل
                  </Button>
                </Group>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>

      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}
      <Group justify="space-between">
        <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addBrand}>
          ضيف ماركة
        </Button>
        <Group>
          <Button variant="default" disabled={!changed || busy} onClick={() => setBrands(saved.brands)}>
            تراجع
          </Button>
          <Button onClick={save} loading={busy} disabled={!changed}>
            حفظ
          </Button>
        </Group>
      </Group>
    </Stack>
  )
}

/** The car makes and models the app offers. Owners only. */
export function CarsPage() {
  const { isOwner } = useSession()
  const query = useApi<CarsSettings>('/settings')
  if (!isOwner) return <Navigate to="/" replace />
  const cars = query.data?.cars

  return (
    <Stack>
      <Title order={2}>العربيات</Title>
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {cars && (
          <Card withBorder>
            {/* Saved data starts the editor afresh. */}
            <CarsEditor key={cars.updatedAt ?? 'launch'} saved={cars} />
          </Card>
        )}
      </QueryState>
    </Stack>
  )
}
