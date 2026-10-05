import { Cell, Legend, Pie, PieChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import DataTable from '../common/DataTable'
import EmptyState from '../common/EmptyState'
import { formatMetric } from './reportFormat'

const COLORS = {
  Online: '#0d5c59',
  Offline: '#8d2424',
  Maintenance: '#7a5b12',
  Disabled: '#5c6570',
}

export default function DeviceStatusChart({ report }) {
  const overall = report?.overall
  if (!overall || overall.total === 0) return <EmptyState message="No devices are available for this selection." />

  const pie = [
    { name: 'Online', value: overall.online },
    { name: 'Offline', value: overall.offline },
    { name: 'Maintenance', value: overall.maintenance },
    { name: 'Disabled', value: overall.disabled },
  ].filter((item) => item.value > 0)

  return (
    <section>
      <p className="lede">Availability is online devices divided by all devices. It is not calculated when there are no devices.</p>
      <p><strong>Availability: {formatMetric(overall.availabilityPercent, '%')}</strong></p>
      <div className="chart-frame" role="img" aria-label="Device status distribution">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={pie} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
              {pie.map((item) => <Cell key={item.name} fill={COLORS[item.name]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-frame" role="img" aria-label="Devices by type">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={report.byType} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#d5dde6" />
            <XAxis dataKey="deviceType" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="total" name="Devices" fill="#1d4f91" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        rowKey={(row) => row.buildingId}
        rows={report.byBuilding || []}
        columns={[
          { key: 'building', header: 'Building', render: (row) => row.buildingName },
          { key: 'total', header: 'Devices', render: (row) => row.total },
          { key: 'online', header: 'Online', render: (row) => row.online },
          { key: 'offline', header: 'Offline', render: (row) => row.offline },
          { key: 'availability', header: 'Availability', render: (row) => formatMetric(row.availabilityPercent, '%') },
        ]}
      />
    </section>
  )
}
