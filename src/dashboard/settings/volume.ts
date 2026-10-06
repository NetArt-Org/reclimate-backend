/**
 * Volume maths and form definitions for kiln and measuring-container templates.
 * Pure functions only, so they are easy to test.
 */

export type Unit = 'mm' | 'cm' | 'm'
export type TemplateKind = 'kiln' | 'container'

export type KilnShape = 'conical' | 'cylinder' | 'rectangular' | 'squarePyramid'
export type ContainerShape = 'cylinder' | 'cuboid' | 'conical'
export type Shape = KilnShape | ContainerShape

export interface DimensionField {
  key: string
  label: string
}

export interface ShapeDef {
  value: Shape
  label: string
  fields: DimensionField[]
}

export const UNITS: Unit[] = ['mm', 'cm', 'm']

export const KILN_SHAPES: ShapeDef[] = [
  {
    value: 'conical',
    label: 'Conical (frustum)',
    fields: [
      { key: 'upperDiameter', label: 'Upper surface diameter' },
      { key: 'lowerDiameter', label: 'Lower surface diameter' },
      { key: 'depth', label: 'Depth' },
    ],
  },
  {
    value: 'cylinder',
    label: 'Cylinder',
    fields: [
      { key: 'diameter', label: 'Diameter' },
      { key: 'depth', label: 'Depth' },
    ],
  },
  {
    value: 'rectangular',
    label: 'Rectangular',
    fields: [
      { key: 'length', label: 'Length' },
      { key: 'width', label: 'Width' },
      { key: 'depth', label: 'Depth' },
    ],
  },
  {
    value: 'squarePyramid',
    label: 'Square pyramid (frustum)',
    fields: [
      { key: 'upperSide', label: 'Upper side' },
      { key: 'lowerSide', label: 'Lower side' },
      { key: 'depth', label: 'Depth' },
    ],
  },
]

export const CONTAINER_SHAPES: ShapeDef[] = [
  {
    value: 'cylinder',
    label: 'Cylinder',
    fields: [
      { key: 'diameter', label: 'Diameter' },
      { key: 'height', label: 'Height' },
    ],
  },
  {
    value: 'cuboid',
    label: 'Cuboid',
    fields: [
      { key: 'length', label: 'Length' },
      { key: 'width', label: 'Width' },
      { key: 'height', label: 'Height' },
    ],
  },
  {
    value: 'conical',
    label: 'Conical (frustum)',
    fields: [
      { key: 'upperDiameter', label: 'Upper diameter' },
      { key: 'lowerDiameter', label: 'Lower diameter' },
      { key: 'height', label: 'Height' },
    ],
  },
]

export const shapesFor = (kind: TemplateKind) => (kind === 'kiln' ? KILN_SHAPES : CONTAINER_SHAPES)

export const shapeDef = (kind: TemplateKind, shape: string) => shapesFor(kind).find((s) => s.value === shape)

/** Minimum sensible volume in litres. */
export const MIN_VOLUME_L: Record<TemplateKind, number> = { kiln: 100, container: 1 }

/** Convert a length in `unit` to centimetres. */
export const toCm = (value: number, unit: Unit) => (unit === 'mm' ? value / 10 : unit === 'm' ? value * 100 : value)

const cm3ToL = (cm3: number) => cm3 / 1000

/** Frustum of a cone with diameters D and d and height h (all cm) → litres. */
export const frustumConeL = (D: number, d: number, h: number) => cm3ToL(((Math.PI * h) / 12) * (D * D + D * d + d * d))

/** Cylinder with diameter d and height h (cm) → litres. */
export const cylinderL = (d: number, h: number) => cm3ToL(Math.PI * (d / 2) ** 2 * h)

/** Box l × w × h (cm) → litres. */
export const boxL = (l: number, w: number, h: number) => cm3ToL(l * w * h)

/** Frustum of a square pyramid with sides a1 and a2 and height h (cm) → litres. */
export const squareFrustumL = (a1: number, a2: number, h: number) => {
  const A1 = a1 * a1
  const A2 = a2 * a2
  return cm3ToL((h / 3) * (A1 + A2 + Math.sqrt(A1 * A2)))
}

/**
 * Volume in litres for a shape, from dimensions given in `unit`.
 * Returns 0 when a dimension is missing, not a number or not positive.
 */
export function volumeLitres(shape: string, dims: Record<string, number | undefined>, unit: Unit): number {
  const get = (k: string) => {
    const v = dims[k]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? toCm(v, unit) : null
  }
  const all = (...keys: string[]) => {
    const vals = keys.map(get)
    return vals.every((v): v is number => v !== null) ? vals : null
  }
  const h = 'depth' in dims ? 'depth' : 'height'
  let v: number[] | null
  switch (shape) {
    case 'conical':
      return (v = all('upperDiameter', 'lowerDiameter', h)) ? frustumConeL(v[0], v[1], v[2]) : 0
    case 'cylinder':
      return (v = all('diameter', h)) ? cylinderL(v[0], v[1]) : 0
    case 'rectangular':
    case 'cuboid':
      return (v = all('length', 'width', h)) ? boxL(v[0], v[1], v[2]) : 0
    case 'squarePyramid':
      return (v = all('upperSide', 'lowerSide', h)) ? squareFrustumL(v[0], v[1], v[2]) : 0
    default:
      return 0
  }
}

/** "Ø 180 / 60 × 90 cm", "Ø 50 × 40 cm", "100 × 80 × 60 cm", "□ 120 / 80 × 90 cm" */
export function formatDimensions(shape: string, dims: Record<string, number>, unit: Unit): string {
  const f = (k: string) => (dims[k] === undefined ? '?' : String(+dims[k].toFixed(2)))
  const h = 'depth' in dims ? 'depth' : 'height'
  switch (shape) {
    case 'conical':
      return `Ø ${f('upperDiameter')} / ${f('lowerDiameter')} × ${f(h)} ${unit}`
    case 'cylinder':
      return `Ø ${f('diameter')} × ${f(h)} ${unit}`
    case 'rectangular':
    case 'cuboid':
      return `${f('length')} × ${f('width')} × ${f(h)} ${unit}`
    case 'squarePyramid':
      return `□ ${f('upperSide')} / ${f('lowerSide')} × ${f(h)} ${unit}`
    default:
      return Object.values(dims).join(' × ') + ` ${unit}`
  }
}
