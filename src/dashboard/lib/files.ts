import type { DocFile } from '../data/types'
import { uploadFile } from '../server/actions'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from '../server/result'
import { unwrap } from './unwrap'

/** Upload a picked file to Neon; the result is kept on the record (training docs, SOPs…). */
export async function readDoc(file: File): Promise<DocFile> {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`Files can be at most ${MAX_UPLOAD_LABEL}`)
  const form = new FormData()
  form.append('file', file)
  return unwrap(await uploadFile(form))
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
