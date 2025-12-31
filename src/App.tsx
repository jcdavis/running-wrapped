import { useState, useEffect } from 'react'

interface Activity {
  id: string
  datetime: string
  duration: number
  distance: number
  heartrate: number[]
  velocity_smooth: number[]
}

interface DayData {
  date: string
  distance: number
  count: number
  activities: Activity[]
}

function App() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [selectionStart, setSelectionStart] = useState<string | null>(null) // Store date string
  const [selectionEnd, setSelectionEnd] = useState<string | null>(null) // Store date string
  const [isDragging, setIsDragging] = useState(false)
  const [unit, setUnit] = useState<'km' | 'miles'>('km')

  useEffect(() => {
    fetch('/data/processed_activities.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load activities')
        return res.json()
      })
      .then(data => {
        setActivities(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const getActivityGrid = () => {
    // Create a map of date to activities
    const dateMap = new Map<string, { distance: number; count: number; activities: Activity[] }>()

    activities.forEach(activity => {
      // Extract just the date part (YYYY-MM-DD)
      const date = activity.datetime.split('T')[0]
      const existing = dateMap.get(date) || { distance: 0, count: 0, activities: [] }
      dateMap.set(date, {
        distance: existing.distance + activity.distance,
        count: existing.count + 1,
        activities: [...existing.activities, activity]
      })
    })

    // Generate 7x52 grid starting from Jan 1, 2025
    const startDate = new Date('2025-01-01')
    const weeks: DayData[][] = []

    // Calculate which day of week Jan 1 is (0 = Sunday, 6 = Saturday)
    const startDayOfWeek = startDate.getDay()

    // Create 53 weeks to cover the entire year (52 weeks = 364 days, need extra week for full coverage)
    for (let week = 0; week < 53; week++) {
      const weekData: DayData[] = []

      for (let day = 0; day < 7; day++) {
        // Calculate the date for this cell
        const dayOffset = week * 7 + day - startDayOfWeek
        const currentDate = new Date(startDate)
        currentDate.setDate(startDate.getDate() + dayOffset)

        const dateStr = currentDate.toISOString().split('T')[0]
        const data = dateMap.get(dateStr)

        weekData.push({
          date: dateStr,
          distance: data?.distance || 0,
          count: data?.count || 0,
          activities: data?.activities || []
        })
      }

      weeks.push(weekData)
    }

    return weeks
  }

  const getMonthLabels = () => {
    const startDate = new Date('2025-01-01')
    const startDayOfWeek = startDate.getDay()
    const labels: { month: string; weekIndex: number }[] = []
    let currentMonth = -1

    for (let week = 0; week < 53; week++) {
      const dayOffset = week * 7 - startDayOfWeek
      const currentDate = new Date(startDate)
      currentDate.setDate(startDate.getDate() + dayOffset)

      // Skip if date is before the start of 2025
      if (currentDate < startDate) {
        continue
      }

      const month = currentDate.getMonth()

      if (month !== currentMonth) {
        currentMonth = month
        labels.push({
          month: currentDate.toLocaleDateString('en-US', { month: 'short' }),
          weekIndex: week
        })
      }
    }

    return labels
  }

  const getColorClass = (distance: number) => {
    if (distance === 0) return 'bg-gray-800'

    const km = distance / 1000

    // Darker green = more distance (GitHub style)
    if (km >= 30) return 'bg-green-900'
    if (km >= 20) return 'bg-green-700'
    if (km >= 10) return 'bg-green-500'
    return 'bg-green-400' // 1-10km
  }

  const formatDistance = (meters: number) => {
    if (unit === 'km') {
      const km = meters / 1000
      return km.toFixed(2)
    } else {
      const miles = (meters / 1000) * 0.621371
      return miles.toFixed(2)
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`
  }

  const formatPace = (activity: Activity) => {
    // Calculate average pace from velocity_smooth array
    if (activity.velocity_smooth.length === 0) return 'N/A'

    const avgVelocity = activity.velocity_smooth.reduce((sum, v) => sum + v, 0) / activity.velocity_smooth.length

    if (avgVelocity === 0) return 'N/A'

    if (unit === 'km') {
      // Convert m/s to min/km: min/km = 1000 / (m/s * 60)
      const minPerKm = 1000 / (avgVelocity * 60)
      const minutes = Math.floor(minPerKm)
      const seconds = Math.round((minPerKm % 1) * 60)
      return `${minutes}:${String(seconds).padStart(2, '0')}`
    } else {
      // Convert m/s to min/mile: min/mile = 1609.34 / (m/s * 60)
      const minPerMile = 1609.34 / (avgVelocity * 60)
      const minutes = Math.floor(minPerMile)
      const seconds = Math.round((minPerMile % 1) * 60)
      return `${minutes}:${String(seconds).padStart(2, '0')}`
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getTotalDistance = () => {
    return activities.reduce((sum, activity) => sum + activity.distance, 0)
  }

  const getTotalRuns = () => {
    return activities.length
  }

  const handleMouseDown = (dateStr: string) => {
    setSelectionStart(dateStr)
    setSelectionEnd(dateStr)
    setIsDragging(true)
  }

  const handleMouseEnter = (dateStr: string) => {
    if (isDragging) {
      setSelectionEnd(dateStr)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const isInSelection = (dateStr: string) => {
    if (!selectionStart || !selectionEnd) return false

    const date = new Date(dateStr + 'T00:00:00')
    const startDate = new Date(selectionStart + 'T00:00:00')
    const endDate = new Date(selectionEnd + 'T00:00:00')

    const minDate = startDate < endDate ? startDate : endDate
    const maxDate = startDate > endDate ? startDate : endDate

    return date >= minDate && date <= maxDate
  }

  const getSelectionStats = () => {
    if (!selectionStart || !selectionEnd) return null

    let totalDistance = 0
    let totalRuns = 0

    const startDate = new Date(selectionStart + 'T00:00:00')
    const endDate = new Date(selectionEnd + 'T00:00:00')

    const minDate = startDate < endDate ? startDate : endDate
    const maxDate = startDate > endDate ? startDate : endDate

    // Iterate through all days in the grid
    for (const week of grid) {
      for (const day of week) {
        const dayDate = new Date(day.date + 'T00:00:00')
        if (dayDate >= minDate && dayDate <= maxDate) {
          totalDistance += day.distance
          totalRuns += day.count
        }
      }
    }

    return {
      distance: totalDistance,
      runs: totalRuns,
      startDate: minDate.toISOString().split('T')[0],
      endDate: maxDate.toISOString().split('T')[0]
    }
  }

  const getSelectionHistograms = () => {
    if (!selectionStart || !selectionEnd) return null

    const startDate = new Date(selectionStart + 'T00:00:00')
    const endDate = new Date(selectionEnd + 'T00:00:00')
    const minDate = startDate < endDate ? startDate : endDate
    const maxDate = startDate > endDate ? startDate : endDate

    const velocityData: number[] = []
    const heartrateData: number[] = []

    // Collect all data points from activities in range
    activities.forEach(activity => {
      const activityDate = new Date(activity.datetime.split('T')[0] + 'T00:00:00')
      if (activityDate >= minDate && activityDate <= maxDate) {
        velocityData.push(...activity.velocity_smooth)
        heartrateData.push(...activity.heartrate)
      }
    })

    // Create histogram bins for velocity (m/s)
    const velocityBins = new Array(16).fill(0)
    if (unit === 'km') {
      // Convert m/s to min/km: min/km = 1000 / (m/s * 60)
      // 16 bins from 3:00 to 7:00 min/km (15s intervals)
      velocityData.forEach(v => {
        if (v > 0) {
          const minPerKm = 1000 / (v * 60)
          // Bin range: 3:00-7:00 min/km (pace), bins of 15 seconds (0.25 min)
          const binIndex = Math.floor((minPerKm - 3) / 0.25)
          if (binIndex >= 0 && binIndex < velocityBins.length) {
            velocityBins[binIndex]++
          }
        }
      })
    } else {
      // Convert m/s to min/mile: min/mile = 1609.34 / (m/s * 60)
      // 16 bins from 5:00 to 11:00 min/mile (22.5s intervals)
      velocityData.forEach(v => {
        if (v > 0) {
          const minPerMile = 1609.34 / (v * 60)
          // Bin range: 5:00-11:00 min/mile (pace), bins of 22.5 seconds (0.375 min)
          const binIndex = Math.floor((minPerMile - 5) / 0.375)
          if (binIndex >= 0 && binIndex < velocityBins.length) {
            velocityBins[binIndex]++
          }
        }
      })
    }

    // Create histogram bins for heart rate (bpm)
    const heartrateBins = new Array(21).fill(0) // 21 bins from 95 to 200 bpm (5 bpm intervals)
    heartrateData.forEach(hr => {
      if (hr > 0) {
        const binIndex = Math.floor((hr - 95) / 5)
        if (binIndex >= 0 && binIndex < heartrateBins.length) {
          heartrateBins[binIndex]++
        }
      }
    })

    return { velocityBins, heartrateBins }
  }

  const clearSelection = () => {
    setSelectionStart(null)
    setSelectionEnd(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading activities...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl text-red-400">Error: {error}</div>
      </div>
    )
  }

  const grid = getActivityGrid()
  const monthLabels = getMonthLabels()
  const selectionStats = getSelectionStats()

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold">Running Activity 2025</h1>
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setUnit('km')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  unit === 'km' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Kilometers
              </button>
              <button
                onClick={() => setUnit('miles')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  unit === 'miles' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Miles
              </button>
            </div>
          </div>
          <div className="flex gap-8 text-gray-300">
            <div>
              <span className="text-2xl font-semibold text-white">{getTotalRuns()}</span>
              <span className="ml-2">runs</span>
            </div>
            <div>
              <span className="text-2xl font-semibold text-white">{formatDistance(getTotalDistance())}</span>
              <span className="ml-2">{unit} total</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Less</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 bg-gray-800 border border-gray-700 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-400 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-700 rounded-sm"></div>
                <div className="w-3 h-3 bg-green-900 rounded-sm"></div>
              </div>
              <span className="text-sm text-gray-400">More</span>
            </div>
          </div>

          <div className="relative overflow-x-auto">
            {/* Month labels */}
            <div className="flex gap-1 mb-2 ml-10">
              <div className="flex relative" style={{ width: `${53 * 16}px`, height: '16px' }}>
                {monthLabels.map((label, idx) => (
                  <div
                    key={idx}
                    className="absolute text-xs text-gray-400"
                    style={{ left: `${label.weekIndex * 16}px` }}
                  >
                    {label.month}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-1">
              {/* Day labels */}
              <div className="flex flex-col justify-start text-xs text-gray-400" style={{ width: '32px' }}>
                <div style={{ height: '16px' }}></div>
                <div style={{ height: '16px' }}>Mon</div>
                <div style={{ height: '16px' }}></div>
                <div style={{ height: '16px' }}>Wed</div>
                <div style={{ height: '16px' }}></div>
                <div style={{ height: '16px' }}>Fri</div>
                <div style={{ height: '16px' }}></div>
              </div>

              {/* Grid */}
              <div className="flex-1" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                <div className="flex gap-1">
                  {grid.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-1">
                      {week.map((day, dayIndex) => {
                        const isSelected = isInSelection(day.date)
                        return (
                          <div
                            key={`${weekIndex}-${dayIndex}`}
                            className={`w-3 h-3 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-white ${getColorClass(day.distance)} ${
                              isSelected ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-800' : ''
                            }`}
                            onMouseDown={() => handleMouseDown(day.date)}
                            onMouseEnter={(e) => {
                              setHoveredDay(day)
                              setTooltipPosition({ x: e.clientX, y: e.clientY })
                              handleMouseEnter(day.date)
                            }}
                            onMouseLeave={() => {
                              setHoveredDay(null)
                              setTooltipPosition(null)
                            }}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

        {selectionStats && (() => {
          const histograms = getSelectionHistograms()
          const maxVelocityCount = histograms ? Math.max(...histograms.velocityBins) : 0
          const maxHeartrateCount = histograms ? Math.max(...histograms.heartrateBins) : 0

          return (
            <div className="mt-6 bg-blue-900/30 border border-blue-500/50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-blue-300 mb-2">Selected Range</h3>
                  <div className="text-sm text-gray-300 mb-3">
                    {formatDate(selectionStats.startDate)} - {formatDate(selectionStats.endDate)}
                  </div>
                  <div className="flex gap-6 text-gray-300">
                    <div>
                      <span className="text-xl font-semibold text-white">{selectionStats.runs}</span>
                      <span className="ml-2">runs</span>
                    </div>
                    <div>
                      <span className="text-xl font-semibold text-white">{formatDistance(selectionStats.distance)}</span>
                      <span className="ml-2">{unit} total</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={clearSelection}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Clear Selection
                </button>
              </div>

              {histograms && (
                <div className="grid grid-cols-2 gap-6 mt-6">
                  {/* Velocity Histogram */}
                  <div>
                    <h4 className="text-sm font-semibold text-blue-200 mb-3">
                      Pace Distribution (min/{unit === 'km' ? 'km' : 'mi'})
                    </h4>
                    <div className="flex gap-2">
                      {/* Y-axis */}
                      <div className="flex flex-col justify-between text-xs text-gray-400 pr-2" style={{ height: '128px' }}>
                        <div>{maxVelocityCount}</div>
                        <div>{Math.round(maxVelocityCount * 0.75)}</div>
                        <div>{Math.round(maxVelocityCount * 0.5)}</div>
                        <div>{Math.round(maxVelocityCount * 0.25)}</div>
                        <div>0</div>
                      </div>
                      {/* Chart area */}
                      <div className="flex-1">
                        {/* Bars */}
                        <div className="flex items-end gap-1 h-32 border-l border-b border-gray-600">
                          {histograms.velocityBins.map((count, i) => {
                            const height = maxVelocityCount > 0 ? (count / maxVelocityCount) * 100 : 0
                            const paceMin = unit === 'km' ? 3 + i * 0.25 : 5 + i * 0.375
                            const paceLabel = `${Math.floor(paceMin)}:${String(Math.round((paceMin % 1) * 60)).padStart(2, '0')}`
                            return (
                              <div key={i} className="flex-1 flex items-end h-full">
                                <div
                                  className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-400"
                                  style={{ height: `${height}%` }}
                                  title={`${paceLabel}: ${count} samples`}
                                />
                              </div>
                            )
                          })}
                        </div>
                        {/* X-axis labels */}
                        <div className="flex gap-1 mt-1">
                          {histograms.velocityBins.map((_, i) => {
                            const paceMin = unit === 'km' ? 3 + i * 0.25 : 5 + i * 0.375
                            const paceLabel = `${Math.floor(paceMin)}:${String(Math.round((paceMin % 1) * 60)).padStart(2, '0')}`
                            return (
                              <div key={i} className="flex-1 text-center">
                                {i % 4 === 0 && (
                                  <div className="text-xs text-gray-400 transform rotate-45 origin-top whitespace-nowrap">
                                    {paceLabel}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Heart Rate Histogram */}
                  <div>
                    <h4 className="text-sm font-semibold text-blue-200 mb-3">Heart Rate Distribution (bpm)</h4>
                    <div className="flex gap-2">
                      {/* Y-axis */}
                      <div className="flex flex-col justify-between text-xs text-gray-400 pr-2" style={{ height: '128px' }}>
                        <div>{maxHeartrateCount}</div>
                        <div>{Math.round(maxHeartrateCount * 0.75)}</div>
                        <div>{Math.round(maxHeartrateCount * 0.5)}</div>
                        <div>{Math.round(maxHeartrateCount * 0.25)}</div>
                        <div>0</div>
                      </div>
                      {/* Chart area */}
                      <div className="flex-1">
                        {/* Bars */}
                        <div className="flex items-end gap-1 h-32 border-l border-b border-gray-600">
                          {histograms.heartrateBins.map((count, i) => {
                            const height = maxHeartrateCount > 0 ? (count / maxHeartrateCount) * 100 : 0
                            const bpm = 95 + i * 5
                            return (
                              <div key={i} className="flex-1 flex items-end h-full">
                                <div
                                  className="w-full bg-red-500 rounded-t transition-all hover:bg-red-400"
                                  style={{ height: `${height}%` }}
                                  title={`${bpm}-${bpm + 5} bpm: ${count} samples`}
                                />
                              </div>
                            )
                          })}
                        </div>
                        {/* X-axis labels */}
                        <div className="flex gap-1 mt-1">
                          {histograms.heartrateBins.map((_, i) => {
                            const bpm = 95 + i * 5
                            return (
                              <div key={i} className="flex-1 text-center">
                                {i % 4 === 0 && (
                                  <div className="text-xs text-gray-400">
                                    {bpm}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Tooltip */}
        {hoveredDay && hoveredDay.distance > 0 && tooltipPosition && (
          <div
            className="fixed bg-gray-950 text-white px-3 py-2 rounded shadow-lg text-sm z-50 pointer-events-none border border-gray-700"
            style={{
              left: `${tooltipPosition.x + 10}px`,
              top: `${tooltipPosition.y + 10}px`
            }}
          >
            <div className="font-semibold mb-2">{formatDate(hoveredDay.date)}</div>
            <div className="space-y-1">
              {hoveredDay.activities.map((activity, idx) => (
                <div key={activity.id} className="text-gray-300">
                  {hoveredDay.count > 1 && <span className="text-gray-500">Run {idx + 1}: </span>}
                  <span>{formatDistance(activity.distance)} {unit}</span>
                  <span className="mx-1">•</span>
                  <span>{formatDuration(activity.duration)}</span>
                  <span className="mx-1">•</span>
                  <span>{formatPace(activity)} /{unit === 'km' ? 'km' : 'mi'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-400">
          <p>Each square represents a day. Darker greens indicate more distance run.</p>
          <p className="mt-1">Click and drag to select a range of days to see totals.</p>
        </div>
      </div>
    </div>
  )
}

export default App
