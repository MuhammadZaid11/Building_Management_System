import { Link } from 'react-router-dom'
import { useState } from 'react'
import DataTable from '../common/DataTable'
import EmptyState from '../common/EmptyState'
import { formatMetric, healthClass } from './reportFormat'
import { formatKwh, formatMoney } from '../../utils/format'

const SORTERS = {
  healthScore: (row) => (row.healthScore === null ? -1 : row.healthScore),
  energyConsumptionKwh: (row) => row.energyConsumptionKwh || 0,
  deviceAvailability: (row) => (row.deviceAvailability === null ? -1 : row.deviceAvailability),
  activeAlarms: (row) => row.activeAlarms || 0,
  overdueMaintenance: (row) => row.overdueMaintenance || 0,
}

export default function BuildingComparison({ report }) {
  const [sort, setSort] = useState('healthScore')
  const rows = [...(report?.buildings || [])].sort((left, right) => SORTERS[sort](right) - SORTERS[sort](left))

  if (rows.length === 0) return <EmptyState message="No buildings match this report." />

  return (
    <section>
      <div className="toolbar no-print">
        <label>
          Sort
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="healthScore">Health score</option>
            <option value="energyConsumptionKwh">Energy consumption</option>
            <option value="deviceAvailability">Device availability</option>
            <option value="activeAlarms">Active alarms</option>
            <option value="overdueMaintenance">Overdue maintenance</option>
          </select>
        </label>
      </div>
      <DataTable
        rowKey={(row) => row.buildingId}
        rows={rows}
        columns={[
          { key: 'name', header: 'Building', render: (row) => <Link to={`/buildings/${row.buildingId}`}>{row.name}</Link> },
          { key: 'health', header: 'Health', render: (row) => row.healthStatus ? <span className={healthClass(row.healthStatus)}>{formatMetric(row.healthScore)}</span> : 'Not calculated' },
          { key: 'devices', header: 'Devices', render: (row) => row.deviceCount },
          { key: 'availability', header: 'Availability', render: (row) => formatMetric(row.deviceAvailability, '%') },
          { key: 'alarms', header: 'Active alarms', render: (row) => row.activeAlarms },
          { key: 'critical', header: 'Critical alarms', render: (row) => row.criticalAlarms },
          { key: 'energy', header: 'Energy', render: (row) => formatKwh(row.energyConsumptionKwh) },
          { key: 'cost', header: 'Estimated cost', render: (row) => formatMoney(row.estimatedCost, report.currency) },
          { key: 'open', header: 'Open maintenance', render: (row) => row.openMaintenance },
          { key: 'overdue', header: 'Overdue maintenance', render: (row) => row.overdueMaintenance },
        ]}
      />
    </section>
  )
}
