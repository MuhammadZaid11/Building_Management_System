import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatKwh, formatMoney } from '../../utils/format'

export default function BuildingComparisonChart({ buildings, currency }) {
  if (!buildings || buildings.length === 0) {
    return <p>No buildings are available.</p>
  }

  return (
    <div className="chart-frame" role="img" aria-label="Building energy comparison">
      <ResponsiveContainer width="100%" height={Math.max(220, buildings.length * 56)}>
        <BarChart data={buildings} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="#d5dde6" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="buildingName" width={150} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value, name, item) => {
            if (name === 'consumptionKwh') {
              const cost = formatMoney(item.payload.cost, currency)
              return [`${formatKwh(value)} · ${cost}`, 'Consumption']
            }
            return [value, name]
          }} />
          <Bar dataKey="consumptionKwh" name="consumptionKwh" fill="#1d4f91" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
