/**
 * Generates a jdenticon color for a given identifier
 * @param id - The unique identifier to generate an icon for (pubkey, protocolID, etc)
 * @returns A color string
 */
import { Hash, Utils } from '@bsv/sdk'

export const deterministicColor = (id: string): string => {
  // Generate the SVG as a string
  const color = Utils.toHex(Hash.sha256(id).slice(0, 6))
  
  return `#${color}`
};

export default deterministicColor;
