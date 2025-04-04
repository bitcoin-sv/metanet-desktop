interface FetchManifestParams {
  domain: string
}

export default async function fetchManifest({
  domain,
}: FetchManifestParams): Promise<any | undefined> {
  try {
    // Remove any protocol prefixes (even if duplicated)
    const cleanDomain = domain.replace(/^(https?:\/\/)+/, '')

    // Decide protocol: use 'http' for localhost, otherwise default to 'https'
    const protocol = cleanDomain.startsWith('localhost:') ? 'http' : 'https'

    // Construct the final URL with the cleaned domain
    const url = `${protocol}://${cleanDomain}/manifest.json`
    
    // const response = await fetch(url, { method: 'GET' })
    // if (!response.ok) {
    //   throw new Error(`HTTP error! status: ${response.status}`)
    // }

    return {} //await response.json()
  } catch (error) {
    // console.error(error)
    // Ignore the error as it's not our problem
    return undefined
  }
}
