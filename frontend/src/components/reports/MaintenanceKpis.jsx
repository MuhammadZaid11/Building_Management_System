import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import EmptyState from '../common/EmptyState'
import { formatMetric } from './reportFormat'
import { formatCost } from '../../utils/format'

export default function MaintenanceKpis({ report }) {
  if (!report) return null
  const summary = report.summary || {}
  const chart = [
    { name: 'Open', value: summary.open },
    { name: 'Assigned', value: summary.assigned },
    { name: 'In progress', value: summary.inProgress },
    { name: 'On hold', value: summary.onHold },
    { name: 'Completed', value: summary.completed },
    { name: 'Cancelled', value: summary.cancelled },
  ]

  return (
    <section>
      {summary.total === 0 ? <EmptyState message="No work orders were created in this period." /> : (
        <div className="chart-frame" role="img" aria-label="Work orders by status">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#d5dde6" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" name="Work orders" fill="#1d4f91" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="summary-grid">
        <Link className="summary-card" to="/maintenance"><span>Completion rate</span><strong>{formatMetric(report.completionRate, '%')}</strong></Link>
        <article className="summary-card"><span>Average resolution</span><strong>{report.averageResolutionHours === null || report.averageResolutionHours === undefined ? 'Insufficient data' : `${report.averageResolutionHours} h`}</strong></article>
        <Link className="summary-card" to="/maintenance?priority=CRITICAL"><span>Critical open</span><strong>{summary.critical ?? 0}</strong></Link>
        <Link className="summary-card" to="/maintenance/schedules"><span>Overdue schedules</span><strong>{summary.overdue ?? 0}</strong></Link>
        <article className="summary-card"><span>Recorded cost</span><strong>{report.totalCost === null || report.totalCost === undefined ? 'Not calculated' : formatCost(report.totalCost)}</strong></article>
      </div>
      <p className="lede">Completion rate excludes cancelled work. Resolution time is completedAt minus createdAt, and only for completed orders that have both timestamps. Cost is activity lines plus the additional completion amount.</p>
    </section>
  )
}
