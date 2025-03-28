/**
 * Generates a jdenticon color for a given identifier
 * @param id - The unique identifier to generate an icon for (pubkey, protocolID, etc)
 * @returns A color string
 */
import { Hash, Utils } from '@bsv/sdk'

export const deterministicColor = (id: string): string => {
  const hash = Hash.sha256(id)
  // Generate the SVG as a string
  const color1 = `#${Utils.toHex(hash.slice(0, 3))}`
  const color2 = `#${Utils.toHex(hash.slice(3, 6))}`
  const color3 = `#${Utils.toHex(hash.slice(6, 9))}`
  const color4 = `#${Utils.toHex(hash.slice(9, 12))}`
  const color5 = `#${Utils.toHex(hash.slice(12, 15))}`
  const color6 = `#${Utils.toHex(hash.slice(15, 18))}`
  
  return `linear-gradient(90deg, ${color1}, ${color2}, ${color3}, ${color4}, ${color5}, ${color6})`
};

export default deterministicColor;
