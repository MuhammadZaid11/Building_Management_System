import { useEffect, useState } from 'react'
import FormField from '../common/FormField'
import { WORK_ORDER_PRIORITIES } from '../../constants/maintenance'
import { useAuth } from '../../hooks/useAuth'
import { getAlarm, listAlarms } from '../../services/alarm.service'
import { listBuildings } from '../../services/building.service'
import { listDevices } from '../../services/device.service'
import { createWorkOrder, listTechnicians } from '../../services/maintenance.service'
import { canManageMaintenance } from '../../utils/access'
import { getErrorMessage } from '../../utils/errors'

function toIso(value) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function locationLabel(device) {
  const room = device?.room
  const zone = room?.zone
  const floor = zone?.floor
  const building = floor?.building
  if (!building) return ''
  return [building.name, floor?.name, zone?.name, room?.name].filter(Boolean).join(' / ')
}

export default function WorkOrderForm({ deviceId = '', alarmId = '', onCreated, onCancel }) {
  const { user } = useAuth()
  const canAssign = canManageMaintenance(user)
  const [buildings, setBuildings] = useState([])
  const [buildingId, setBuildingId] = useState('')
  const [devices, setDevices] = useState([])
  const [alarms, setAlarms] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedDeviceId, setSelectedDeviceId] = useState(deviceId)
  const [selectedAlarmId, setSelectedAlarmId] = useState(alarmId)
  const [priority, setPriority] = useState('MEDIUM')
  const [assignedToId, setAssignedToId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [error, setError] = useState('')
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
    if (canAssign) {
      listTechnicians()
        .then((data) => {
          if (!ignore) setTechnicians(data)
        })
        .catch(() => {
          if (!ignore) setTechnicians([])
        })
    }
    return () => {
      ignore = true
    }
  }, [canAssign])

  useEffect(() => {
    if (!alarmId) return undefined
    let ignore = false
    getAlarm(alarmId)
      .then((alarm) => {
        if (ignore) return
        setSelectedAlarmId(alarm.id)
        setSelectedDeviceId(alarm.deviceId || alarm.device?.id || deviceId)
        setBuildingId(alarm.buildingId || alarm.building?.id || '')
        setTitle((current) => current || `Inspect ${alarm.message}`)
        setDescription((current) => current || alarm.message)
        if (alarm.severity === 'CRITICAL' || alarm.severity === 'HIGH') setPriority(alarm.severity)
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [alarmId, deviceId])

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
    if (!selectedDeviceId) {
      setAlarms([])
      return undefined
    }
    let ignore = false
    listAlarms({ deviceId: selectedDeviceId, page: 1, limit: 20 })
      .then((data) => {
        if (!ignore) setAlarms(data.items)
      })
      .catch(() => {
        if (!ignore) setAlarms([])
      })
    return () => {
      ignore = true
    }
  }, [selectedDeviceId])

  const selectedDevice = devices.find((device) => device.id === selectedDeviceId)

  async function onSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const created = await createWorkOrder({
        title,
        description: description || undefined,
        deviceId: selectedDeviceId,
        alarmId: selectedAlarmId || undefined,
        priority,
        assignedToId: assignedToId || undefined,
        scheduledAt: toIso(scheduledAt),
        estimatedCost: estimatedCost === '' ? undefined : estimatedCost,
      })
      onCreated(created)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="stack-form" onSubmit={onSubmit}>
      {error ? <p className="form-error">{error}</p> : null}
      <FormField id="wo-title" label="Title">
        <input id="wo-title" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} />
      </FormField>
      <FormField id="wo-description" label="Description">
        <textarea id="wo-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
      </FormField>
      <FormField id="wo-building" label="Building">
        <select id="wo-building" value={buildingId} onChange={(event) => { setBuildingId(event.target.value); setSelectedDeviceId(''); setSelectedAlarmId('') }}>
          <option value="">All buildings</option>
          {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
        </select>
      </FormField>
      <FormField id="wo-device" label="Device">
        <select id="wo-device" value={selectedDeviceId} onChange={(event) => { setSelectedDeviceId(event.target.value); setSelectedAlarmId('') }} required>
          <option value="">Select a device</option>
          {devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
        </select>
      </FormField>
      {selectedDevice ? <p className="lede">{locationLabel(selectedDevice)}</p> : null}
      <FormField id="wo-alarm" label="Alarm">
        <select id="wo-alarm" value={selectedAlarmId} onChange={(event) => setSelectedAlarmId(event.target.value)}>
          <option value="">None</option>
          {alarms.map((alarm) => <option key={alarm.id} value={alarm.id}>{alarm.type}: {alarm.message}</option>)}
        </select>
      </FormField>
      <FormField id="wo-priority" label="Priority">
        <select id="wo-priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
          {WORK_ORDER_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </FormField>
      {canAssign ? (
        <FormField id="wo-technician" label="Assigned technician">
          <select id="wo-technician" value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)}>
            <option value="">Unassigned</option>
            {technicians.map((person) => <option key={person.id} value={person.id}>{person.name} ({person.role})</option>)}
          </select>
        </FormField>
      ) : null}
      <FormField id="wo-scheduled" label="Scheduled date and time">
        <input id="wo-scheduled" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
      </FormField>
      <FormField id="wo-estimate" label="Estimated cost">
        <input id="wo-estimate" inputMode="decimal" value={estimatedCost} onChange={(event) => setEstimatedCost(event.target.value)} />
      </FormField>
      <div className="row-actions">
        <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving...' : 'Create work order'}</button>
        <button type="button" className="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
