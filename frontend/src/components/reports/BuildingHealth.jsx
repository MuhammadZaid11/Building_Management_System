import { Link } from 'react-router-dom'
import { useState } from 'react'
import DataTable from '../common/DataTable'
import EmptyState from '../common/EmptyState'
import { formatMetric, healthClass } from './reportFormat'

export default function BuildingHealth({ report }) {
  const [sort, setSort] = useState('score')
  const buildings = [...(report?.buildings || [])].sort((left, right) => {
    const leftScore = left.score === null ? -1 : left.score
    const rightScore = right.score === null ? -1 : right.score
    return sort === 'lowest' ? leftScore - rightScore : rightScore - leftScore
  })

  if (buildings.length === 0) return <EmptyState message="No buildings are available for a health score." />

  return (
    <section>
      <div className="row-actions no-print">
        <button type="button" className={sort === 'score' ? 'button button-primary' : 'button'} onClick={() => setSort('score')}>Highest score</button>
        <button type="button" className={sort === 'lowest' ? 'button button-primary' : 'button'} onClick={() => setSort('lowest')}>Lowest score</button>
      </div>
      <p className="lede">{report.formula?.description} Device availability 40%, alarm condition 30%, maintenance condition 20%, sensor health 10%. A component is omitted when there is nothing to measure.</p>
      <DataTable
        rowKey={(building) => building.buildingId}
        rows={buildings}
        columns={[
          { key: 'name', header: 'Building', render: (building) => <Link to={`/buildings/${building.buildingId}`}>{building.buildingName}</Link> },
          { key: 'score', header: 'Score', render: (building) => formatMetric(building.score) },
          { key: 'status', header: 'Status', render: (building) => building.status ? <span className={healthClass(building.status)}>{building.status}</span> : 'Not calculated' },
          { key: 'devices', header: 'Devices', render: (building) => formatMetric(building.components.deviceAvailability) },
          { key: 'alarms', header: 'Alarms', render: (building) => formatMetric(building.components.alarmCondition) },
          { key: 'maintenance', header: 'Maintenance', render: (building) => formatMetric(building.components.maintenanceCondition) },
          { key: 'sensors', header: 'Sensors', render: (building) => formatMetric(building.components.sensorHealth) },
        ]}
      />
    </section>
  )
}
