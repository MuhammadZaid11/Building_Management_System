import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../../components/common/DataTable'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import FormField from '../../components/common/FormField'
import LoadingState from '../../components/common/LoadingState'
import Modal from '../../components/common/Modal'
import { DueStateBadge } from '../../components/common/StatusBadge'
import { MAINTENANCE_FREQUENCIES } from '../../constants/maintenance'
import { useAuth } from '../../hooks/useAuth'
import { listBuildings } from '../../services/building.service'
import { listDevices } from '../../services/device.service'
import { createSchedule, listSchedules } from '../../services/maintenance.service'
import { canManageMaintenance } from '../../utils/access'
import { getErrorMessage } from '../../utils/errors'
import { formatDateTime } from '../../utils/format'

function toIso(value) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export default function SchedulesPage() {
  const { user } = useAuth()
  const canManage = canManageMaintenance(user)
  const [buildingId, setBuildingId] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [dueOnly, setDueOnly] = useState(false)
  const [buildings, setBuildings] = useState([])
  const [devices, setDevices] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState('MONTHLY')
  const [nextDueAt, setNextDueAt] = useState('')
  const [scheduleDeviceId, setScheduleDeviceId] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

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

  useEffect(() => {
    let ignore = false
    listDevices({ buildingId, page: 1, limit: 100 })
      .then((data) => {
        if (!ignore) setDevices(data.items)
      })
      .catch(() => {
        if (!ignore) setDevices([])
      })
    return () => {
      ignore = true
    }
  }, [buildingId])

  useEffect(() => {
    let ignore = false
    setLoading(true)
    listSchedules({
      page: 1,
      limit: 50,
      buildingId,
      deviceId,
      due: dueOnly ? 'true' : '',
    })
      .then((data) => {
        if (!ignore) {
          setItems(data.items)
          setError('')
        }
      })
      .catch((requestError) => {
        if (!ignore) setError(getErrorMessage(requestError))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [buildingId, deviceId, dueOnly, reloadKey])

  async function onCreate(event) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      await createSchedule({
        title,
        description: description || undefined,
        deviceId: scheduleDeviceId,
        frequency,
        nextDueAt: toIso(nextDueAt),
        isActive: true,
      })
      setCreating(false)
      setTitle('')
      setDescription('')
      setNextDueAt('')
      setReloadKey((value) => value + 1)
    } catch (requestError) {
      setFormError(getErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  if (loading && items.length === 0 && !error) return <LoadingState message="Loading schedules..." />
  if (error && items.length === 0) return <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Preventive maintenance</h1>
          <p className="lede">Schedules show when service is due. They do not create work orders automatically. Status uses UTC dates.</p>
        </div>
        <div className="row-actions">
          <Link className="button" to="/maintenance">Work orders</Link>
          {canManage ? <button type="button" className="button button-primary" onClick={() => setCreating(true)}>Add schedule</button> : null}
        </div>
      </div>
      <div className="toolbar">
        <label>
          Building
          <select value={buildingId} onChange={(event) => { setBuildingId(event.target.value); setDeviceId('') }}>
            <option value="">All</option>
            {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
          </select>
        </label>
        <label>
          Device
          <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
            <option value="">All</option>
            {devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
          </select>
        </label>
        <label>
          Due
          <select value={dueOnly ? 'true' : ''} onChange={(event) => setDueOnly(event.target.value === 'true')}>
            <option value="">All active and inactive</option>
            <option value="true">Due or overdue now</option>
          </select>
        </label>
      </div>
      {items.length === 0 ? <EmptyState message="No maintenance schedules match this selection." /> : (
        <DataTable
          rowKey={(schedule) => schedule.id}
          rows={items}
          columns={[
            { key: 'title', header: 'Schedule', render: (schedule) => schedule.title },
            { key: 'device', header: 'Device', render: (schedule) => schedule.device ? <Link to={`/devices/${schedule.device.id}`}>{schedule.device.name}</Link> : '—' },
            { key: 'building', header: 'Building', render: (schedule) => schedule.building?.name || '—' },
            { key: 'frequency', header: 'Frequency', render: (schedule) => schedule.frequency },
            { key: 'last', header: 'Last completed', render: (schedule) => formatDateTime(schedule.lastCompletedAt) },
            { key: 'next', header: 'Next due', render: (schedule) => formatDateTime(schedule.nextDueAt) },
            { key: 'status', header: 'Status', render: (schedule) => <DueStateBadge status={schedule.dueState} /> },
          ]}
        />
      )}
      {creating ? (
        <Modal title="Add schedule" onClose={() => setCreating(false)}>
          <form className="stack-form" onSubmit={onCreate}>
            {formError ? <p className="form-error">{formError}</p> : null}
            <FormField id="schedule-title" label="Title">
              <input id="schedule-title" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} />
            </FormField>
            <FormField id="schedule-description" label="Description">
              <textarea id="schedule-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </FormField>
            <FormField id="schedule-device" label="Device">
              <select id="schedule-device" value={scheduleDeviceId} onChange={(event) => setScheduleDeviceId(event.target.value)} required>
                <option value="">Select a device</option>
                {devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
              </select>
            </FormField>
            <FormField id="schedule-frequency" label="Frequency">
              <select id="schedule-frequency" value={frequency} onChange={(event) => setFrequency(event.target.value)}>
                {MAINTENANCE_FREQUENCIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </FormField>
            <FormField id="schedule-due" label="Next due">
              <input id="schedule-due" type="datetime-local" value={nextDueAt} onChange={(event) => setNextDueAt(event.target.value)} required />
            </FormField>
            <div className="row-actions">
              <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving...' : 'Create schedule'}</button>
              <button type="button" className="button" onClick={() => setCreating(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  )
}
