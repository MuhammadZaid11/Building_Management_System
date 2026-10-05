import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDateTime } from '../../utils/format'

function finite(value) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export default function ReadingChart({ readings, unit, minValue, maxValue }) {
  const minimum = finite(minValue)
  const maximum = finite(maxValue)
  const data = readings.map((reading) => ({
    value: Number(reading.value),
    label: formatDateTime(reading.recordedAt),
  }))
  const samples = data.map((point) => point.value)
  const bounds = [minimum, maximum].filter((value) => value !== null)
  const extent = [...samples, ...bounds]
  const low = Math.min(...extent)
  const high = Math.max(...extent)
  const pad = high === low ? 1 : (high - low) * 0.08

  return (
    <div className="chart-frame" role="img" aria-label={`Sensor readings in ${unit}`}>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="#d5dde6" />
          <XAxis dataKey="label" minTickGap={28} tick={{ fontSize: 12 }} />
          <YAxis domain={[low - pad, high + pad]} tick={{ fontSize: 12 }} label={{ value: unit, angle: -90, position: 'insideLeft' }} />
          <Tooltip formatter={(value, name) => [`${value} ${unit}`, name]} />
          <Legend />
          {minimum !== null ? (
            <ReferenceLine y={minimum} stroke="#7a5b12" strokeDasharray="5 4" label={{ value: 'Min', fill: '#7a5b12', fontSize: 12 }} />
          ) : null}
          {maximum !== null ? (
            <ReferenceLine y={maximum} stroke="#8a2424" strokeDasharray="5 4" label={{ value: 'Max', fill: '#8a2424', fontSize: 12 }} />
          ) : null}
          <Line type="monotone" dataKey="value" name="Reading" stroke="#0d5c59" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
