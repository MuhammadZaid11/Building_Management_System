import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Breadcrumbs from '../../components/common/Breadcrumbs'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import DataTable from '../../components/common/DataTable'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import FormField from '../../components/common/FormField'
import LoadingState from '../../components/common/LoadingState'
import Modal from '../../components/common/Modal'
import Pagination from '../../components/common/Pagination'
import { useAuth } from '../../hooks/useAuth'
import { getFloor } from '../../services/floor.service'
import { createRoom, deleteRoom, listRooms, updateRoom } from '../../services/room.service'
import { getZone } from '../../services/zone.service'
import { canManageInfrastructure } from '../../utils/access'
import { getErrorMessage, getFieldErrors } from '../../utils/errors'

const EMPTY_FORM = { name: '', roomNumber: '', description: '' }

function validateRoom(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Name is required.'
  else if (form.name.trim().length > 150) errors.name = 'Name must be at most 150 characters.'
  if (!form.roomNumber.trim()) errors.roomNumber = 'Room number is required.'
  else if (form.roomNumber.trim().length > 40) errors.roomNumber = 'Room number must be at most 40 characters.'
  if (form.description.trim().length > 2000) errors.description = 'Description must be at most 2000 characters.'
  return errors
}

export default function ZoneDetailsPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const canWrite = canManageInfrastructure(user)
  const [zone, setZone] = useState(null)
  const [floor, setFloor] = useState(null)
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)
  const [formMode, setFormMode] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    getZone(id)
      .then(async (zoneData) => {
        const [floorData, rooms] = await Promise.all([
          getFloor(zoneData.floor.id),
          listRooms({ zoneId: id, page, limit: 20 }),
        ])
        if (!ignore) {
          setZone(zoneData)
          setFloor(floorData)
          setResult(rooms)
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
  }, [id, page, version])

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormErrors({})
    setFormError('')
    setFormMode({ type: 'create' })
  }

  function openEdit(room) {
    setForm({ name: room.name, roomNumber: room.roomNumber, description: room.description || '' })
    setFormErrors({})
    setFormError('')
    setFormMode({ type: 'edit', id: room.id })
  }

  async function submitForm(event) {
    event.preventDefault()
    const errors = validateRoom(form)
    setFormErrors(errors)
    setFormError('')
    if (Object.keys(errors).length > 0) return
    const payload = { name: form.name.trim(), roomNumber: form.roomNumber.trim(), description: form.description.trim() || null }
    setSaving(true)
    try {
      if (formMode.type === 'create') {
        await createRoom({ ...payload, zoneId: id })
        setNotice('Room created.')
      } else {
        await updateRoom(formMode.id, payload)
        setNotice('Room updated.')
      }
      setVersion((value) => value + 1)
      setFormMode(null)
    } catch (requestError) {
      const fields = getFieldErrors(requestError)
      setFormErrors(fields)
      setFormError(Object.keys(fields).length > 0 ? 'Please check the information and try again.' : getErrorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteRoom(pendingDelete.id)
      setPendingDelete(null)
      setNotice('Room deleted.')
      setVersion((value) => value + 1)
    } catch (requestError) {
      setDeleteError(getErrorMessage(requestError))
    } finally {
      setDeleting(false)
    }
  }

  if (loading && !zone) return <LoadingState message="Loading zone..." />
  if (error || !zone || !floor) return <ErrorState message={error || 'The requested information could not be found.'} />

  const items = result?.items || []

  return (
    <section>
      <Breadcrumbs
        items={[
          { label: 'Buildings', to: '/buildings' },
          { label: floor.building.name, to: `/buildings/${floor.building.id}` },
          { label: floor.name, to: `/floors/${floor.id}` },
          { label: zone.name },
        ]}
      />
      <div className="page-heading">
        <div>
          <h1>{zone.name}</h1>
          <p className="lede">Code {zone.code}</p>
        </div>
        {canWrite ? <button type="button" className="button button-primary" onClick={openCreate}>Add room</button> : null}
      </div>
      {zone.description ? <p>{zone.description}</p> : null}
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      <h2>Rooms</h2>
      {items.length === 0 ? <EmptyState message="No rooms found." /> : (
        <>
          <DataTable
            rowKey={(room) => room.id}
            rows={items}
            columns={[
              { key: 'name', header: 'Name', render: (room) => room.name },
              { key: 'number', header: 'Room number', render: (room) => room.roomNumber },
              { key: 'description', header: 'Description', render: (room) => room.description || '—' },
              {
                key: 'actions',
                header: 'Actions',
                render: (room) => (
                  <div className="row-actions">
                    <Link className="button button-quiet" to={`/rooms/${room.id}`}>View</Link>
                    {canWrite ? <button type="button" className="button button-quiet" onClick={() => openEdit(room)}>Edit</button> : null}
                    {canWrite ? <button type="button" className="button button-danger" onClick={() => { setDeleteError(''); setPendingDelete(room) }}>Delete</button> : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination page={result.pagination.page} total={result.pagination.total} totalPages={result.pagination.totalPages} onPage={setPage} />
        </>
      )}
      {formMode ? (
        <Modal title={formMode.type === 'create' ? 'Add room' : 'Edit room'} onClose={() => setFormMode(null)}>
          <form onSubmit={submitForm} noValidate>
            <FormField id="room-name" label="Name" error={formErrors.name}>
              <input id="room-name" value={form.name} maxLength={150} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </FormField>
            <FormField id="room-number" label="Room number" error={formErrors.roomNumber}>
              <input id="room-number" value={form.roomNumber} maxLength={40} onChange={(event) => setForm({ ...form, roomNumber: event.target.value })} />
            </FormField>
            <FormField id="room-description" label="Description" error={formErrors.description}>
              <textarea id="room-description" rows={3} maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </FormField>
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
          title="Delete room"
          message={`Are you sure you want to delete ${pendingDelete.name}? The server will reject the delete if devices still belong to this room.`}
          busy={deleting}
          error={deleteError}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  )
}
