import type { DocFile } from '../data/types'
import { uid } from './utils'

/** Images up to this size are kept inline so they survive a reload (prototype only). */
const INLINE_LIMIT = 1_500_000

/** Turn a picked file into a DocFile. Later this becomes an upload to Payload's media collection. */
export async function readDoc(file: File): Promise<DocFile> {
  const doc: DocFile = { id: uid('doc-'), name: file.name, size: file.size, type: file.type, addedAt: new Date().toISOString() }
  if (file.type.startsWith('image/') && file.size <= INLINE_LIMIT) {
    doc.url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }
  return doc
}

export const fileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1048576).toFixed(1)} MB`

/** Read polygons out of a KML file: every <coordinates> block becomes one ring of [lat, lng]. */
export async function parseKml(file: File) {
  const xml = new DOMParser().parseFromString(await file.text(), 'application/xml')
  if (xml.querySelector('parsererror')) throw new Error('This file is not valid KML.')
  const placemarks = xml.getElementsByTagName('Placemark').length
  const polygons = [...xml.getElementsByTagName('coordinates')]
    .map((el) =>
      (el.textContent ?? '')
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(',').map(Number))
        .filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng))
        .map(([lng, lat]) => [lat, lng] as [number, number]),
    )
    .filter((ring) => ring.length > 2)
  if (!polygons.length) throw new Error('No boundaries found in this file.')
  return { placemarks, polygons }
}
