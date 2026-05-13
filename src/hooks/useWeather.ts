import { useQuery } from '@tanstack/react-query'
import { fetchForecast, detectLocation, type WeatherDay } from '@/services/weather'
import { useSettingsStore } from '@/stores/settingsStore'

export function useWeather(): WeatherDay | null {
  const prefs     = useSettingsStore(s => s.prefs)
  const setPrefs  = useSettingsStore(s => s.setPrefs)

  const query = useQuery<WeatherDay[]>({
    queryKey: ['weather', prefs.weatherLat, prefs.weatherLon],
    queryFn: async () => {
      let lat = prefs.weatherLat
      let lon = prefs.weatherLon
      if (!lat || !lon) {
        const loc = await detectLocation()
        lat = loc.lat
        lon = loc.lon
        setPrefs({ weatherLat: lat, weatherLon: lon, weatherCity: loc.city })
      }
      return fetchForecast(lat, lon)
    },
    staleTime: 1000 * 60 * 30,
  })

  return query.data?.[0] ?? null
}
