import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export default function EnergyTrendChart({ points, source }) {
  if (!points || points.length === 0) {
    return <p>No consumption was recorded for this period.</p>
  }

  return (
    <div className="chart-frame" role="img" aria-label="Energy consumption trend in kilowatt hours">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={points} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="#d5dde6" />
          <XAxis dataKey="period" minTickGap={24} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} label={{ value: 'kWh', angle: -90, position: 'insideLeft' }} />
          <Tooltip formatter={(value, name) => [name === 'cost' ? value : `${value} kWh`, name === 'cost' ? 'Estimated cost' : 'Consumption']} />
          <Bar dataKey="consumptionKwh" name={source === 'ESTIMATED' ? 'Estimated consumption' : 'Consumption'} fill="#0d5c59" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
