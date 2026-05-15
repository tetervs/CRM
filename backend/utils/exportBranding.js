const fs   = require('fs')
const path = require('path')

const LOGO_PATH = path.resolve(__dirname, '../../frontend/public/company.svg')

let cachedLogoUri = null

const getLogoDataUri = () => {
  if (cachedLogoUri !== null) return cachedLogoUri
  try {
    const svg = fs.readFileSync(LOGO_PATH, 'utf8')
    cachedLogoUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  } catch {
    console.warn('[exportBranding] logo not found at', LOGO_PATH)
    cachedLogoUri = ''
  }
  return cachedLogoUri
}

const getBrandingData = (user, dateRange, documentTitle) => ({
  logoDataUri:   getLogoDataUri(),
  documentTitle,
  generatedAt:   new Date(),
  generatedBy:   { name: user.name, role: user.role },
  dateRange,
})

module.exports = { getBrandingData, getLogoDataUri }
