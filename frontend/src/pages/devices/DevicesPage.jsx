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
import StatusBadge from '../../components/common/StatusBadge'
import LocationSelector from '../../components/devices/LocationSelector'
import { DEVICE_STATUSES, DEVICE_TYPES } from '../../constants/devices'
import { useAuth } from '../../hooks/useAuth'
import { listBuildings } from '../../services/building.service'
import { createDevice, deleteDevice, listDevices, updateDevice } from '../../services/device.service'
import { getRoom, listRooms } from '../../services/room.service'
import { canManageDevices, canUpdateDeviceStatus } from '../../utils/access'
import { getErrorMessage, getFieldErrors } from '../../utils/errors'
import { formatDateTime, formatDeviceLocation, formatLastSeen } from '../../utils/format'

const EMPTY_LOCATION = { buildingId: '', floorId: '', zoneId: '', roomId: '' }
const EMPTY_FORM = {
  name: '',
  deviceCode: '',
  deviceType: 'HVAC',
  manufacturer: '',
  model: '',
  status: 'ONLINE',
  installedAt: '',
}

function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function validateDevice(form, location, statusOnly) {
  const errors = {}
  if (statusOnly) {
    if (!DEVICE_STATUSES.includes(form.status)) errors.status = 'Status is not valid.'
    return errors
  }
  if (!form.name.trim()) errors.name = 'Name is required.'
  else if (form.name.trim().length > 150) errors.name = 'Name must be at most 150 characters.'
  if (!form.deviceCode.trim()) errors.deviceCode = 'Device code is required.'
  else if (form.deviceCode.trim().length > 80) errors.deviceCode = 'Device code must be at most 80 characters.'
  if (!DEVICE_TYPES.includes(form.deviceType)) errors.deviceType = 'Device type is not supported.'
  if (!DEVICE_STATUSES.includes(form.status)) errors.status = 'Status is not valid.'
  if (form.manufacturer.trim().length > 120) errors.manufacturer = 'Manufacturer must be at most 120 characters.'
  if (form.model.trim().length > 120) errors.model = 'Model must be at most 120 characters.'
  if (!location.roomId) errors.roomId = 'Room is required.'
  if (form.installedAt && Number.isNaN(new Date(form.installedAt).getTime())) errors.installedAt = 'Installed date is not valid.'
  return errors
}

function toPayload(form, location) {
  return {
    name: form.name.trim(),
    deviceCode: form.deviceCode.trim(),
    deviceType: form.deviceType,
    manufacturer: form.manufacturer.trim() || null,
    model: form.model.trim() || null,
    roomId: location.roomId,
    status: form.status,
    installedAt: form.installedAt ? new Date(form.installedAt).toISOString() : null,
  }
}

function locationFromDevice(device) {
  const room = device.room
  const zone = room?.zone
  const floor = zone?.floor
  const building = floor?.building
  return {
    buildingId: building?.id || '',
    floorId: floor?.id || '',
    zoneId: zone?.id || '',
    roomId: room?.id || '',
  }
}

export default function DevicesPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const page = Math.max(Number(params.get('page')) || 1, 1)
  const search = params.get('search') || ''
  const status = params.get('status') || ''
  const deviceType = params.get('deviceType') || ''
  const buildingId = params.get('buildingId') || ''
  const roomId = params.get('roomId') || ''
  const [searchInput, setSearchInput] = useState(search)
  const [buildings, setBuildings] = useState([])
  const [rooms, setRooms] = useState([])
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
  const canManage = canManageDevices(user)
  const canUpdateStatus = canUpdateDeviceStatus(user)

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
      if (!roomId) return undefined
      getRoom(roomId)
        .then((room) => {
          if (!ignore) setRooms([room])
        })
        .catch(() => {
          if (!ignore) setRooms([])
        })
      return () => {
        ignore = true
      }
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
  }, [buildingId, roomId])

  useEffect(() => {
    let ignore = false
    setLoading(true)
    listDevices({ page, limit: 20, search, status, deviceType, buildingId, roomId })
      .then((data) => {
        if (!ignore) {
          setResult(data)
          setError('')
        }
      })
      .catch((requestError) => {
        if (!ignore) {
          setResult(null)
          setError(getErrorMessage(requestError))
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [page, search, status, deviceType, buildingId, roomId, reloadKey])

  function updateParam(key, value) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key === 'buildingId') next.delete('roomId')
      if (key !== 'page') next.delete('page')
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

  function openEdit(device) {
    setForm({
      name: device.name,
      deviceCode: device.deviceCode,
      deviceType: device.deviceType,
      manufacturer: device.manufacturer || '',
      model: device.model || '',
      status: device.status,
      installedAt: toDateTimeLocal(device.installedAt),
    })
    setLocation(locationFromDevice(device))
    setFormErrors({})
    setFormError('')
    setFormMode({ type: 'edit', id: device.id })
  }

  function openStatus(device) {
    setForm({ ...EMPTY_FORM, status: device.status, name: device.name })
    setFormErrors({})
    setFormError('')
    setFormMode({ type: 'status', id: device.id })
  }

  async function submitForm(event) {
    event.preventDefault()
    const statusOnly = formMode?.type === 'status'
    const errors = validateDevice(form, location, statusOnly)
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    setFormError('')
    try {
      if (statusOnly) {
        await updateDevice(formMode.id, { status: form.status })
        setNotice('Device status updated.')
      } else if (formMode.type === 'create') {
        await createDevice(toPayload(form, location))
        setNotice('Device created.')
      } else {
        await updateDevice(formMode.id, toPayload(form, location))
        setNotice('Device updated.')
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
      await deleteDevice(pendingDelete.id)
      setNotice('Device deleted.')
      setPendingDelete(null)
      setReloadKey((value) => value + 1)
    } catch (requestError) {
      setDeleteError(getErrorMessage(requestError))
    } finally {
      setDeleting(false)
    }
  }

  if (loading && !result) return <LoadingState message="Loading devices..." />
  if (error && !result) return <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />

  const items = result?.items || []
  const emptyMessage = buildingId && !search && !status && !deviceType && !roomId
    ? 'No devices are currently assigned to this building.'
    : 'No devices found.'
  const statusOnly = formMode?.type === 'status'

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Devices</h1>
          <p className="lede">Equipment installed in rooms. These are records, not live connections.</p>
        </div>
        {canManage ? <button type="button" className="button button-primary" onClick={openCreate}>Add device</button> : null}
      </div>
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      <div className="toolbar">
        <label>
          Search
          <input type="search" value={searchInput} placeholder="Name or code" onChange={(event) => setSearchInput(event.target.value)} />
        </label>
        <label>
          Type
          <select value={deviceType} onChange={(event) => updateParam('deviceType', event.target.value)}>
            <option value="">All</option>
            {DEVICE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => updateParam('status', event.target.value)}>
            <option value="">All</option>
            {DEVICE_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
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
          <select value={roomId} onChange={(event) => updateParam('roomId', event.target.value)} disabled={!buildingId && !roomId}>
            <option value="">All</option>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
        </label>
      </div>
      {error ? <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {items.length === 0 && !error ? <EmptyState message={emptyMessage} /> : null}
      {(items.length > 0 || (result?.pagination?.page > 1 && !error)) ? (
        <>
          {items.length > 0 ? <DataTable
            rowKey={(device) => device.id}
            rows={items}
            columns={[
              { key: 'name', header: 'Name', render: (device) => device.name },
              { key: 'code', header: 'Code', render: (device) => device.deviceCode },
              { key: 'type', header: 'Type', render: (device) => device.deviceType },
              { key: 'location', header: 'Location', render: (device) => formatDeviceLocation(device) },
              { key: 'status', header: 'Status', render: (device) => <StatusBadge status={device.status} /> },
              { key: 'manufacturer', header: 'Manufacturer', render: (device) => device.manufacturer || '—' },
              { key: 'model', header: 'Model', render: (device) => device.model || '—' },
              { key: 'seen', header: 'Last seen', render: (device) => formatLastSeen(device.lastSeenAt) },
              {
                key: 'actions',
                header: 'Actions',
                render: (device) => (
                  <div className="row-actions">
                    <Link className="button button-quiet" to={`/devices/${device.id}`}>View</Link>
                    {canManage ? <button type="button" className="button button-quiet" onClick={() => openEdit(device)}>Edit</button> : null}
                    {!canManage && canUpdateStatus ? <button type="button" className="button button-quiet" onClick={() => openStatus(device)}>Update status</button> : null}
                    {canManage ? <button type="button" className="button button-danger" onClick={() => { setDeleteError(''); setPendingDelete(device) }}>Delete</button> : null}
                  </div>
                ),
              },
            ]}
          /> : null}
          <Pagination
            page={result.pagination.page}
            total={result.pagination.total}
            totalPages={result.pagination.totalPages}
            onPage={(nextPage) => updateParam('page', nextPage > 1 ? String(nextPage) : '')}
          />
        </>
      ) : null}
      {formMode ? (
        <Modal
          title={statusOnly ? 'Update status' : formMode.type === 'create' ? 'Add device' : 'Edit device'}
          onClose={() => setFormMode(null)}
        >
          <form onSubmit={submitForm} noValidate>
            {statusOnly ? (
              <FormField id="device-status" label="Status" error={formErrors.status}>
                <select id="device-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  {DEVICE_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </FormField>
            ) : (
              <>
                <FormField id="device-name" label="Name" error={formErrors.name}>
                  <input id="device-name" value={form.name} maxLength={150} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </FormField>
                <FormField id="device-code" label="Device code" error={formErrors.deviceCode}>
                  <input id="device-code" value={form.deviceCode} maxLength={80} onChange={(event) => setForm({ ...form, deviceCode: event.target.value })} />
                </FormField>
                <FormField id="device-type" label="Device type" error={formErrors.deviceType}>
                  <select id="device-type" value={form.deviceType} onChange={(event) => setForm({ ...form, deviceType: event.target.value })}>
                    {DEVICE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </FormField>
                <FormField id="device-manufacturer" label="Manufacturer" error={formErrors.manufacturer}>
                  <input id="device-manufacturer" value={form.manufacturer} maxLength={120} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} />
                </FormField>
                <FormField id="device-model" label="Model" error={formErrors.model}>
                  <input id="device-model" value={form.model} maxLength={120} onChange={(event) => setForm({ ...form, model: event.target.value })} />
                </FormField>
                <LocationSelector value={location} onChange={setLocation} errors={formErrors} />
                <FormField id="device-status" label="Status" error={formErrors.status}>
                  <select id="device-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                    {DEVICE_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </FormField>
                <FormField id="device-installed" label="Installed at" error={formErrors.installedAt}>
                  <input id="device-installed" type="datetime-local" value={form.installedAt} onChange={(event) => setForm({ ...form, installedAt: event.target.value })} />
                </FormField>
              </>
            )}
            {formError ? <p className="form-error" role="alert">{formError}</p> : null}
            <div className="form-actions">
              <button type="button" className="button button-quiet" onClick={() => setFormMode(null)} disabled={saving}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete device"
          message={`Are you sure you want to delete ${pendingDelete.name}? Sensors, readings, and alarms that belong to this device block the delete. Historical records are not removed.`}
          busy={deleting}
          error={deleteError}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  )
}
