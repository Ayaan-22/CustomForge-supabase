"use client"

import { useState, useEffect } from "react"

interface UseApiOptions {
  mockData?: unknown
  mockFile?: string
}

interface UseApiReturn<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
}

/**
 * Custom hook for fetching data from API with automatic mock data fallback
 * Falls back to mock JSON files if API fails or returns network error
 */
export function useApi<T = unknown>(endpoint: string, options: UseApiOptions = {}): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Try to fetch from API first
        const response = await fetch(endpoint, {
          headers: {
            "Content-Type": "application/json",
          },
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const result = await response.json()
        setData(result)
      } catch (err) {
        console.warn(`[CustomForge] API failed for ${endpoint}, attempting mock data fallback`)

        // Fallback to mock data
        try {
          if (options.mockData) {
            setData(options.mockData as T)
          } else if (options.mockFile) {
            const mockResponse = await fetch(options.mockFile)
            if (mockResponse.ok) {
              const mockResult = await mockResponse.json()
              setData(mockResult)
              console.warn(`[CustomForge] Using mock data from ${options.mockFile}`)
            } else {
              throw new Error("Mock file not found")
            }
          } else {
            throw err
          }
        } catch (mockErr) {
          console.error(`[CustomForge] Failed to load mock data:`, mockErr)
          setError(err instanceof Error ? err : new Error("Unknown error"))
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [endpoint, options])

  return { data, isLoading, error }
}
