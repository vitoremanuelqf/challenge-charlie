import { ReactNode, createContext, useEffect, useState } from 'react'

import { format } from 'date-fns'

import { parseCookies, setCookie } from 'nookies'

import { LocationData } from '~/types/Location'
import { TToday, WeatherData } from '~/types/Weather'
import { TomorrowAndAfter, ForecastData } from '~/types/Forecast'

import { CountiesToIBGEAPIData, CountiesData } from '~/types/Counties'

export interface LocationContextDataProps {
  isLoading: boolean

  tempType: string
  userLocation: LocationData

  today: TToday | undefined
  tomorrowAndAfter: TomorrowAndAfter[] | undefined

  cities: string[] | undefined
  counties: CountiesData[] | undefined

  changeTemperatureTypeToFahrenheit: () => void

  getWeather: (city: string) => Promise<void>
  getForecast: (city: string) => Promise<void>
}

interface LocationContextProviderProps {
  children: ReactNode
}

export const LocationContext = createContext<LocationContextDataProps>(
  {} as LocationContextDataProps,
)

export function LocationContextProvider({
  children,
}: LocationContextProviderProps) {
  const { '@challenge-charlie': currentLocationData } = parseCookies()
  const [isLoading, setIsLoading] = useState(true)

  const [tempType, setTempType] = useState<string>('tempC')
  const [today, setToday] = useState<TToday>()
  const [tomorrowAndAfter, setTomorrowAndAfter] = useState<TomorrowAndAfter[]>()

  const [cities, setCities] = useState<string[] | undefined>()
  const [counties, setCounties] = useState<CountiesData[] | undefined>()

  const [userCoordinates, setUserCoordinates] = useState<{
    latitude: number | null
    longitude: number | null
  }>({
    latitude: null,
    longitude: null,
  })

  const [userLocation, setUserLocation] = useState<LocationData>({
    city: null,
    state: null,
  })

  function changeTemperatureTypeToFahrenheit() {
    if (tempType === 'tempC') {
      setTempType('tempF')
    } else {
      setTempType('tempC')
    }
  }

  async function getUserLocation(
    longitude: number | null,
    latitude: number | null,
  ) {
    if (!currentLocationData) {
      if (!longitude && !latitude) {
        return console.warn('A Longitude e a Latitude não foram encontradas!')
      }

      try {
        const locationResponse = await fetch(
          `/api/location?lon=${longitude}&lat=${latitude}`,
        )
        const newLocationData: LocationData = await locationResponse.json()

        const { city, state } = newLocationData

        setUserLocation({ city, state })

        setCookie(null, '@challenge-charlie', JSON.stringify(newLocationData), {
          maxAge: 1000 * 60 * 60 * 4, // 4 Horas
          path: '/',
        })
      } catch (err) {
        console.error(err)
      }
    }
  }

  async function getWeather(city: string) {
    setIsLoading(true)

    const normalizedCity = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    try {
      const getWeather = await fetch(`/api/weather?cidade=${normalizedCity}`)
      const weatherData: WeatherData = await getWeather.json()

      setToday({
        main: {
          temp: weatherData.main.temp,
          tempC: `${Math.trunc(weatherData.main.temp)} °C`,
          tempF: `${Math.trunc(weatherData.main.temp * 1.8 + 32)} °F`,
          humidity: weatherData.main.humidity,
          pressure: weatherData.main.pressure,
        },
        weather: {
          icon: weatherData.weather[0].icon,
          description: weatherData.weather[0].description,
        },
        wind: {
          deg: weatherData.wind.deg,
          speed: weatherData.wind.speed,
        },
      })

      setIsLoading(false)
    } catch (err) {
      setIsLoading(true)
      console.error('Erro: ', err)
      alert('Cidade não encontrada!')
    }
  }

  async function getForecast(city: string) {
    setIsLoading(true)

    const normalizedCity = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    try {
      const getForecast = await fetch(`/api/forecast?cidade=${normalizedCity}`)
      const { list }: ForecastData = await getForecast.json()

      const today = format(new Date(), 'dd/MM/yyyy')

      const formattedList = list.filter(
        (obj, index, self) =>
          self.findIndex(
            (item) => item.dt_txt === obj.dt_txt && item.dt_txt !== today,
          ) === index,
      )

      setTomorrowAndAfter(
        formattedList.map((item) => {
          return {
            temp: item.main.temp,
            tempC: `${Math.trunc(item.main.temp)} °C`,
            tempF: `${Math.trunc(item.main.temp * 1.8 + 32)} °F`,
            dt_txt: item.dt_txt,
          }
        }),
      )
      setIsLoading(false)
    } catch (err) {
      console.error(err)
      setIsLoading(true)
    }
  }

  async function getCounties() {
    try {
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios`,
      )
      const data: CountiesToIBGEAPIData[] = await response.json()

      const formattedCounties: CountiesData[] = data.map((item) => {
        return {
          id: item.id,
          city: item.nome,
          state: item.microrregiao.mesorregiao.UF.nome,
        }
      })

      const formattedCities: string[] = data.map((item) =>
        item.nome.toLowerCase(),
      )

      setCities(formattedCities)
      setCounties(formattedCounties)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    getCounties()

    if ('geolocation' in navigator && !currentLocationData) {
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        const { latitude, longitude } = coords

        setUserCoordinates({ latitude, longitude })
      })
    } else {
      const { city, state }: LocationData = JSON.parse(currentLocationData)

      setUserLocation({ city, state })
    }
  }, [])

  useEffect(() => {
    const { latitude, longitude } = userCoordinates

    getUserLocation(latitude, longitude)
  }, [userCoordinates])

  useEffect(() => {
    if (userLocation.city) {
      getWeather(userLocation.city)
      getForecast(userLocation.city)
    }
  }, [userLocation])

  return (
    <LocationContext.Provider
      value={{
        isLoading,
        tempType,
        userLocation,
        today,
        tomorrowAndAfter,
        cities,
        counties,
        changeTemperatureTypeToFahrenheit,
        getWeather,
        getForecast,
      }}
    >
      {children}
    </LocationContext.Provider>
  )
}
