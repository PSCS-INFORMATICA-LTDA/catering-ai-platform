import fs from 'fs'
import path from 'path'
import { CDL_LOGO_PATH, type PdfLogoSource } from './cdlLogo'

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

function resolveLogoFilePath(): string | null {
  const filePath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    'public',
    'cdl',
    'logo.png',
  )

  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    return filePath
  }

  return null
}

export function resolvePublicImageForPdf(relFromPublic: string): PdfLogoSource {
  const filePath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    'public',
    ...relFromPublic.split('/'),
  )

  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    return { filePath: null, src: null }
  }

  try {
    const ext = path.extname(filePath).slice(1).toLowerCase()
    const mime = MIME_BY_EXT[ext] ?? 'image/png'
    const data = fs.readFileSync(filePath)
    return {
      filePath,
      src: `data:${mime};base64,${data.toString('base64')}`,
    }
  } catch (error) {
    console.error(`[PDF] Failed to read ${relFromPublic}:`, error)
    return { filePath: null, src: null }
  }
}

export function resolveCdlLogoForPdf(): PdfLogoSource {
  const filePath = resolveLogoFilePath()

  if (!filePath) {
    console.error(
      `[CDL PDF] Logo not found. Expected static file at public/cdl/logo.png (${CDL_LOGO_PATH}).`,
    )
    return { filePath: null, src: null }
  }

  try {
    const ext = path.extname(filePath).slice(1).toLowerCase()
    const mime = MIME_BY_EXT[ext] ?? 'image/png'
    const data = fs.readFileSync(filePath)

    return {
      filePath,
      src: `data:${mime};base64,${data.toString('base64')}`,
    }
  } catch (error) {
    console.error('[CDL PDF] Failed to read logo file:', error)
    return { filePath: null, src: null }
  }
}
