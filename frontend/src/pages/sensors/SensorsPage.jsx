import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import DataTable from '../../components/common/DataTable'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import FormField from '../../components/common/FormField'
import LoadingState from '../../components/common/LoadingState'
import Modal from '../../components/common/Modal'
import Pagination from '../../components/common/Pagination'
import LocationSelector from '../../components/devices/LocationSelector'
import { SENSOR_TYPES, unitsForSensorType } from '../../constants/sensors'
import { useAuth } from '../../hooks/useAuth'
import { listBuildings } from '../../services/building.service'
import { getDevice, listDevices } from '../../services/device.service'
import { listRooms } from '../../services/room.service'
import { createSensor, deleteSensor, listSensors, updateSensor } from '../../services/sensor.service'
import { canManageSensors } from '../../utils/access'
import { getErrorMessage, getFieldErrors } from '../../utils/errors'
import { formatDateTime, formatDeviceLocation } from '../../utils/format'

const EMPTY_LOCATION = { buildingId: '', floorId: '', zoneId: '', roomId: '', deviceId: '' }
const EMPTY_FORM = {
  name: '',
  sensorType: 'TEMPERATURE',
  unit: '°C',
  minValue: '',
  maxValue: '',
}

function validateSensor(form, location) {
  const errors = {}
  const units = unitsForSensorType(form.sensorType)

  if (!form.name.trim()) errors.name = 'Name is required.'
  else if (form.name.trim().length > 150) errors.name = 'Name must be at most 150 characters.'
  if (!SENSOR_TYPES.includes(form.sensorType)) errors.sensorType = 'Sensor type is not supported.'
  if (!units.includes(form.unit)) errors.unit = 'Unit does not match the sensor type.'
  if (!location.deviceId) errors.deviceId = 'Device is required.'

  const min = form.minValue === '' ? null : Number(form.minValue)
  const max = form.maxValue === '' ? null : Number(form.maxValue)
  if (form.minValue !== '' && !Number.isFinite(min)) errors.minValue = 'Minimum must be a number.'
  if (form.maxValue !== '' && !Number.isFinite(max)) errors.maxValue = 'Maximum must be a number.'
  if (min !== null && max !== null && min > max) errors.minValue = 'Minimum must be less than or equal to maximum.'

  return errors
}

function toPayload(form, location) {
  return {
    name: form.name.trim(),
    sensorType: form.sensorType,
    unit: form.unit,
    deviceId: location.deviceId,
    minValue: form.minValue === '' ? null : form.minValue,
    maxValue: form.maxValue === '' ? null : form.maxValue,
  }
}

function locationFromSensor(sensor) {
  const device = sensor.device
  const room = device?.room
  const zone = room?.zone
  const floor = zone?.floor
  const building = floor?.building

  return {
    buildingId: building?.id || '',
    floorId: floor?.id || '',
    zoneId: zone?.id || '',
    roomId: room?.id || '',
    deviceId: device?.id || '',
  }
}

function formatBound(value) {
  return value === null || value === undefined || value === '' ? '—' : value
}

export default function SensorsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const page = Math.max(Number(params.get('page')) || 1, 1)
  const search = params.get('search') || ''
  const sensorType = params.get('sensorType') || ''
  const buildingId = params.get('buildingId') || ''
  const roomId = params.get('roomId') || ''
  const deviceId = params.get('deviceId') || ''
  const [searchInput, setSearchInput] = useState(search)
  const [buildings, setBuildings] = useState([])
  const [rooms, setRooms] = useState([])
  const [devices, setDevices] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [formMode, setFormMode] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [location, setLocation] = useState(EMPTY_LOCATION)
  const [formErrors, setFormErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const canManage = canManageSensors(user)

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextSearch = searchInput.trim()
      if (nextSearch === search) return
      setParams((current) => {
        const next = new URLSearchParams(current)
        if (nextSearch) next.set('search', nextSearch)
        else next.delete('search')
        next.delete('page')
        return next
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, search, setParams])

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
    if (!buildingId) {
      setRooms([])
      return undefined
    }
    listRooms({ buildingId, page: 1, limit: 100 })
      .then((data) => {
        if (!ignore) setRooms(data.items)
      })
      .catch(() => {
        if (!ignore) setRooms([])
      })
    return () => {
      ignore = true
    }
  }, [buildingId])

  useEffect(() => {
    let ignore = false
    if (!buildingId && !roomId) {
      if (!deviceId) {
        setDevices([])
        return undefined
      }
      getDevice(deviceId)
        .then((device) => {
          if (!ignore) setDevices([device])
        })
        .catch(() => {
          if (!ignore) setDevices([])
        })
      return () => {
        ignore = true
      }
    }
    listDevices({ buildingId, roomId, page: 1, limit: 100 })
      .then((data) => {
        if (!ignore) setDevices(data.items)
      })
      .catch(() => {
        if (!ignore) setDevices([])
      })
    return () => {
      ignore = true
    }
  }, [buildingId, roomId, deviceId])

  useEffect(() => {
    let ignore = false
    setLoading(true)
    listSensors({ page, limit: 20, search, sensorType, buildingId, roomId, deviceId })
      .then((data) => {
        if (!ignore) {
          setResult(data)
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
  }, [page, search, sensorType, buildingId, roomId, deviceId, reloadKey])

  function updateParam(key, value) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      if (key === 'buildingId') {
        next.delete('roomId')
        next.delete('deviceId')
      }
      if (key === 'roomId') next.delete('deviceId')
      return next
    })
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setLocation(EMPTY_LOCATION)
    setFormErrors({})
    setFormError('')
    setFormMode({ type: 'create' })
  }

  function openEdit(sensor) {
    const units = unitsForSensorType(sensor.sensorType)
    setForm({
      name: sensor.name,
      sensorType: sensor.sensorType,
      unit: units.includes(sensor.unit) ? sensor.unit : units[0] || sensor.unit,
      minValue: sensor.minValue ?? '',
      maxValue: sensor.maxValue ?? '',
    })
    setLocation(locationFromSensor(sensor))
    setFormErrors({})
    setFormError('')
    setFormMode({ type: 'edit', id: sensor.id })
  }

  function changeType(nextType) {
    const units = unitsForSensorType(nextType)
    setForm((current) => ({
      ...current,
      sensorType: nextType,
      unit: units.includes(current.unit) ? current.unit : units[0] || '',
    }))
  }

  async function submitForm(event) {
    event.preventDefault()
    const errors = validateSensor(form, location)
    setFormErrors(errors)
    setFormError('')
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    try {
      if (formMode.type === 'create') {
        await createSensor(toPayload(form, location))
        setNotice('Sensor created.')
      } else {
        await updateSensor(formMode.id, toPayload(form, location))
        setNotice('Sensor updated.')
      }
      setFormMode(null)
      setReloadKey((value) => value + 1)
    } catch (requestError) {
      setFormErrors(getFieldErrors(requestError))
      setFormError(getErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteSensor(pendingDelete.id)
      setNotice('Sensor deleted.')
      setPendingDelete(null)
      setReloadKey((value) => value + 1)
    } catch (requestError) {
      setDeleteError(getErrorMessage(requestError))
    } finally {
      setDeleting(false)
    }
  }

  if (loading && !result) return <LoadingState message="Loading sensors..." />
  if (error && !result) return <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />

  const items = result?.items || []
  const emptyMessage = buildingId && !search && !sensorType && !roomId && !deviceId
    ? 'No sensors are currently assigned to this building.'
    : 'No sensors found.'
  const units = unitsForSensorType(form.sensorType)

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Sensors</h1>
          <p className="lede">Measurement channels attached to devices. Readings are stored history, not a live feed.</p>
        </div>
        {canManage ? <button type="button" className="button button-primary" onClick={openCreate}>Add sensor</button> : null}
      </div>
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      <div className="toolbar">
        <label>
          Search
          <input type="search" value={searchInput} placeholder="Sensor name" onChange={(event) => setSearchInput(event.target.value)} />
        </label>
        <label>
          Type
          <select value={sensorType} onChange={(event) => updateParam('sensorType', event.target.value)}>
            <option value="">All</option>
            {SENSOR_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label>
          Building
          <select value={buildingId} onChange={(event) => updateParam('buildingId', event.target.value)}>
            <option value="">All</option>
            {buildings.map((building) => <option key={building.id} value={building.id}>{building.name}</option>)}
          </select>
        </label>
        <label>
          Room
          <select value={roomId} onChange={(event) => updateParam('roomId', event.target.value)} disabled={!buildingId}>
            <option value="">All</option>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
        </label>
        <label>
          Device
          <select value={deviceId} onChange={(event) => updateParam('deviceId', event.target.value)} disabled={!buildingId && !roomId && devices.length === 0}>
            <option value="">All</option>
            {devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
          </select>
        </label>
      </div>
      {error ? <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {items.length === 0 && !error ? <EmptyState message={emptyMessage} /> : null}
      {(items.length > 0 || (result?.pagination?.page > 1 && !error)) ? (
        <>
          {items.length > 0 ? (
            <DataTable
              rowKey={(sensor) => sensor.id}
              rows={items}
              columns={[
                { key: 'name', header: 'Name', render: (sensor) => sensor.name },
                { key: 'type', header: 'Type', render: (sensor) => sensor.sensorType },
                { key: 'unit', header: 'Unit', render: (sensor) => sensor.unit },
                { key: 'device', header: 'Device', render: (sensor) => sensor.device?.name || '—' },
                { key: 'location', header: 'Location', render: (sensor) => formatDeviceLocation(sensor.device) },
                { key: 'min', header: 'Min', render: (sensor) => formatBound(sensor.minValue) },
                { key: 'max', header: 'Max', render: (sensor) => formatBound(sensor.maxValue) },
                {
                  key: 'latest',
                  header: 'Latest reading',
                  render: (sensor) => (sensor.latestReading ? `${sensor.latestReading.value} ${sensor.unit}` : 'No readings'),
                },
                {
                  key: 'seen',
                  header: 'Last reading time',
                  render: (sensor) => (sensor.latestReading ? formatDateTime(sensor.latestReading.recordedAt) : '—'),
                },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (sensor) => (
                    <div className="row-actions">
                      <Link className="button button-quiet" to={`/sensors/${sensor.id}`}>View</Link>
                      {canManage ? <button type="button" className="button button-quiet" onClick={() => openEdit(sensor)}>Edit</button> : null}
                      {canManage ? <button type="button" className="button button-danger" onClick={() => { setDeleteError(''); setPendingDelete(sensor) }}>Delete</button> : null}
                    </div>
                  ),
                },
              ]}
            />
          ) : null}
          <Pagination
            page={result.pagination.page}
            total={result.pagination.total}
            totalPages={result.pagination.totalPages}
            onPage={(nextPage) => updateParam('page', nextPage > 1 ? String(nextPage) : '')}
          />
        </>
      ) : null}
      {formMode ? (
        <Modal title={formMode.type === 'create' ? 'Add sensor' : 'Edit sensor'} onClose={() => setFormMode(null)}>
          <form onSubmit={submitForm} noValidate>
            {formError ? <p className="form-error" role="alert">{formError}</p> : null}
            <FormField id="sensor-name" label="Sensor name" error={formErrors.name}>
              <input id="sensor-name" value={form.name} maxLength={150} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </FormField>
            <FormField id="sensor-type" label="Sensor type" error={formErrors.sensorType}>
              <select id="sensor-type" value={form.sensorType} onChange={(event) => changeType(event.target.value)}>
                {SENSOR_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </FormField>
            <FormField id="sensor-unit" label="Unit" error={formErrors.unit}>
              <select id="sensor-unit" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>
                {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </FormField>
            <FormField id="sensor-min" label="Minimum value" error={formErrors.minValue}>
              <input id="sensor-min" inputMode="decimal" value={form.minValue} onChange={(event) => setForm({ ...form, minValue: event.target.value })} />
            </FormField>
            <FormField id="sensor-max" label="Maximum value" error={formErrors.maxValue}>
              <input id="sensor-max" inputMode="decimal" value={form.maxValue} onChange={(event) => setForm({ ...form, maxValue: event.target.value })} />
            </FormField>
            <LocationSelector value={location} onChange={setLocation} errors={formErrors} withDevice />
            <div className="form-actions">
              <button type="button" className="button" onClick={() => setFormMode(null)} disabled={saving}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete sensor"
          message={`Are you sure you want to delete ${pendingDelete.name}? Historical readings are not removed. If readings exist, deletion is blocked.`}
          confirmLabel="Delete"
          error={deleteError}
          busy={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  )
}
