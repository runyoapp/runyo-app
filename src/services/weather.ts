import { WEATHER_CODES } from '@/constants/activities'

export type WeatherDay = {
  date: string         // YYYY-MM-DD
  code: number
  emoji: string
  tempMax: number
  tempMin: number
}

export type LocationInfo = {
  lat: number
  lon: number
  city: string
}

export async function detectLocation(): Promise<LocationInfo> {
  const res = await fetch('https://ipapi.co/json/')
  const data = await res.json() as { latitude: number; longitude: number; city: string }
  return { lat: data.latitude, lon: data.longitude, city: data.city }
}

export async function geocodeCity(city: string): Promise<LocationInfo | null> {
  const q = encodeURIComponent(city)
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    { headers: { 'Accept-Language': 'nl' } },
  )
  const data = await res.json() as { lat: string; lon: string; display_name: string }[]
  if (!data[0]) return null
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    city,
  }
}

export async function fetchForecast(lat: number, lon: number): Promise<WeatherDay[]> {
  const url = [
    'https://api.open-meteo.com/v1/forecast',
    `?latitude=${lat}&longitude=${lon}`,
    '&daily=weathercode,temperature_2m_max,temperature_2m_min',
    '&timezone=Europe%2FAmsterdam',
    '&forecast_days=7',
  ].join('')

  const res = await fetch(url)
  const data = await res.json() as {
    daily: {
      time: string[]
      weathercode: number[]
      temperature_2m_max: number[]
      temperature_2m_min: number[]
    }
  }

  return data.daily.time.map((date, i) => {
    const code = data.daily.weathercode[i]
    return {
      date,
      code,
      emoji: WEATHER_CODES[code] ?? '🌡️',
      tempMax: Math.round(data.daily.temperature_2m_max[i]),
      tempMin: Math.round(data.daily.temperature_2m_min[i]),
    }
  })
}
