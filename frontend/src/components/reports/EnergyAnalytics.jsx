import { Link } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import DataTable from '../common/DataTable'
import EmptyState from '../common/EmptyState'
import { formatChange, formatKwh, formatMoney } from '../../utils/format'

export default function EnergyAnalytics({ report }) {
  if (!report) return null
  const summary = report.summary || {}
  const trend = report.trend || []

  return (
    <section>
      <div className="summary-grid">
        <article className="summary-card"><span>Consumption</span><strong>{formatKwh(summary.consumptionKwh)}</strong></article>
        <article className="summary-card"><span>Estimated cost</span><strong>{formatMoney(summary.estimatedCost, summary.currency)}</strong></article>
        <article className="summary-card"><span>Previous period</span><strong>{formatKwh(summary.previousPeriodKwh)}</strong></article>
        <article className="summary-card"><span>Change</span><strong>{formatChange(summary.changePercent)}</strong></article>
      </div>
      <p className="lede">Consumption uses the existing measured energy calculation. Estimated cost is not a utility bill.</p>
      {trend.length === 0 ? <EmptyState message="No energy consumption was recorded for this period." /> : (
        <div className="chart-frame" role="img" aria-label="Energy consumption trend">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#d5dde6" />
              <XAxis dataKey="period" minTickGap={24} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line dataKey="consumptionKwh" name="kWh" stroke="#0d5c59" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <h3>Top consumers</h3>
      {(report.topDevices || []).length === 0 ? <EmptyState message="No energy meters recorded consumption in this period." /> : (
        <DataTable
          rowKey={(device) => device.deviceId}
          rows={report.topDevices}
          columns={[
            { key: 'device', header: 'Device', render: (device) => <Link to={`/devices/${device.deviceId}`}>{device.deviceName}</Link> },
            { key: 'building', header: 'Building', render: (device) => device.buildingName },
            { key: 'kwh', header: 'Consumption', render: (device) => formatKwh(device.consumptionKwh) },
          ]}
        />
      )}
    </section>
  )
}
