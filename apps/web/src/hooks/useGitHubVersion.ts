import { useState, useEffect } from 'react'
import i18n from '@/i18n'

interface GitHubRelease {
  tag_name: string
  name: string
  published_at: string
  html_url: string
}

interface UseGitHubVersionResult {
  latestVersion: string | null
  isLoading: boolean
  error: Error | null
  releaseUrl: string | null
}

/**
 * Hook to fetch the latest version from GitHub releases
 * @param repoOwner - GitHub repository owner (default: 'rsteckler')
 * @param repoName - GitHub repository name (default: 'AxioCNC')
 * @returns Latest version info from GitHub releases
 */
export function useGitHubVersion(
  repoOwner: string = 'rsteckler',
  repoName: string = 'AxioCNC'
): UseGitHubVersionResult {
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [releaseUrl, setReleaseUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchLatestVersion = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch latest release from GitHub API
        const response = await fetch(
          `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`,
          {
            headers: {
              Accept: 'application/vnd.github.v3+json',
            },
          }
        )

        if (!response.ok) {
          throw new Error(i18n.t('Failed to fetch release: {{status}}', { status: response.statusText }))
        }

        const data: GitHubRelease = await response.json()

        if (cancelled) return

        // Extract version from tag_name (e.g., "v0.0.50" -> "0.0.50")
        const version = data.tag_name.startsWith('v')
          ? data.tag_name.slice(1)
          : data.tag_name

        setLatestVersion(version)
        setReleaseUrl(data.html_url)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchLatestVersion()

    return () => {
      cancelled = true
    }
  }, [repoOwner, repoName])

  return { latestVersion, isLoading, error, releaseUrl }
}

/**
 * Compare two version strings (semver format: x.y.z)
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parseVersion = (v: string): number[] => {
    return v
      .split('.')
      .map((part) => parseInt(part.trim(), 10) || 0)
      .slice(0, 3) // Only compare major.minor.patch
  }

  const parts1 = parseVersion(v1)
  const parts2 = parseVersion(v2)

  for (let i = 0; i < 3; i++) {
    if (parts1[i] < parts2[i]) return -1
    if (parts1[i] > parts2[i]) return 1
  }

  return 0
}
