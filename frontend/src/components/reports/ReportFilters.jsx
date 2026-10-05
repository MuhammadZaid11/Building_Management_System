import { listBuildings } from '../../services/building.service'
import { useEffect, useState } from 'react'

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'custom', label: 'Custom Range' },
]

export function reportRange(preset, from, to) {
  const now = new Date()
  if (preset === 'today') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    return { from: start.toISOString(), to: now.toISOString() }
  }
  if (preset === '7d') {
    return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), to: now.toISOString() }
  }
  if (preset === '30d') {
    return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), to: now.toISOString() }
  }
  if (!from || !to) return null
  const start = new Date(from)
  const end = new Date(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return { from: start.toISOString(), to: end.toISOString() }
}

export default function ReportFilters({
  preset,
  from,
  to,
  buildingId,
  interval,
  onPreset,
  onFrom,
  onTo,
  onBuilding,
  onInterval,
  onRefresh,
  onExportBuildings,
  onExportMaintenance,
  onExportAlarms,
}) {
  const [buildings, setBuildings] = useState([])

  useEffect(() => {
    let ignore = false
    listBuildings({ page: 1, limit: 100 })
      .then((data) => {
        if (!ignore) setBuildings(data.items)
      })
      .catch(() => {
        if (!ignore) setBuildings([])
      })
    return () => {
      ignore = true
    }
  }, [])

  return (
    <div className="toolbar no-print">
      <div className="row-actions" role="group" aria-label="Date range">
        {PRESETS.map((item) => (
          <button key={item.id} type="button" className={preset === item.id ? 'button button-primary' : 'button'} onClick={() => onPreset(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {preset === 'custom' ? (
        <>
          <label>
            From
            <input type="datetime-local" value={from} onChange={(event) => onFrom(event.target.value)} />
          </label>
          <label>
            To
            <input type="datetime-local" value={to} onChange={(event) => onTo(event.target.value)} />
          </label>
        </>
      ) : null}
      <label>
        Building
        <select value={buildingId} onChange={(event) => onBuilding(event.target.value)}>
          <option value="">All buildings</option>
          {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
        </select>
      </label>
      <label>
        Interval
        <select value={interval} onChange={(event) => onInterval(event.target.value)}>
          <option value="hour">Hour</option>
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
      </label>
      <button type="button" className="button" onClick={onRefresh}>Refresh</button>
      <button type="button" className="button" onClick={onExportBuildings}>Export buildings</button>
      <button type="button" className="button" onClick={onExportMaintenance}>Export maintenance</button>
      <button type="button" className="button" onClick={onExportAlarms}>Export alarms</button>
      <button type="button" className="button" onClick={() => window.print()}>Print</button>
    </div>
  )
}
