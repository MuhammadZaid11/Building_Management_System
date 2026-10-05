import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import DataTable from '../common/DataTable'
import EmptyState from '../common/EmptyState'
import { AlarmStatusBadge, SeverityBadge } from '../common/StatusBadge'
import { formatDateTime } from '../../utils/format'

export default function AlarmAnalytics({ report }) {
  if (!report) return null
  const trend = report.trend || []
  const summary = report.summary || {}

  return (
    <section>
      <div className="summary-grid">
        <article className="summary-card"><span>Triggered</span><strong>{summary.total ?? 0}</strong></article>
        <article className="summary-card"><span>Active</span><strong>{summary.active ?? 0}</strong></article>
        <article className="summary-card"><span>Acknowledged</span><strong>{summary.acknowledged ?? 0}</strong></article>
        <article className="summary-card"><span>Resolved</span><strong>{summary.resolved ?? 0}</strong></article>
      </div>
      {trend.length === 0 ? <EmptyState message="No alarms were triggered in this period." /> : (
        <div className="chart-frame" role="img" aria-label="Alarm trend by severity">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#d5dde6" />
              <XAxis dataKey="date" minTickGap={24} tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area dataKey="critical" name="Critical" stackId="alarms" stroke="#8d2424" fill="#f3c7c7" />
              <Area dataKey="high" name="High" stackId="alarms" stroke="#7a5b12" fill="#f3e4c4" />
              <Area dataKey="medium" name="Medium" stackId="alarms" stroke="#1d4f91" fill="#d5e4f6" />
              <Area dataKey="low" name="Low" stackId="alarms" stroke="#5c6570" fill="#e4e7eb" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {(report.byType || []).length > 0 ? (
        <div className="chart-frame" role="img" aria-label="Alarms by type">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={report.byType} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#d5dde6" />
              <XAxis dataKey="type" tick={{ fontSize: 11 }} interval={0} angle={-20} height={70} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="Alarms" fill="#8d2424" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      {(report.alarms || []).length === 0 ? null : (
        <DataTable
          rowKey={(alarm) => alarm.id}
          rows={report.alarms.slice(0, 8)}
          columns={[
            { key: 'severity', header: 'Severity', render: (alarm) => <SeverityBadge severity={alarm.severity} /> },
            { key: 'alarm', header: 'Alarm', render: (alarm) => <Link to={`/alarms/${alarm.id}`}>{alarm.message}</Link> },
            { key: 'device', header: 'Device', render: (alarm) => alarm.device?.name || '—' },
            { key: 'status', header: 'Status', render: (alarm) => <AlarmStatusBadge status={alarm.status} /> },
            { key: 'time', header: 'Triggered', render: (alarm) => formatDateTime(alarm.triggeredAt) },
          ]}
        />
      )}
    </section>
  )
}
