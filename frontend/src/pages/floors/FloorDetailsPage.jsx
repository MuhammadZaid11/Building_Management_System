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
import { createZone, deleteZone, listZones, updateZone } from '../../services/zone.service'
import { canManageInfrastructure } from '../../utils/access'
import { getErrorMessage, getFieldErrors } from '../../utils/errors'

const EMPTY_FORM = { name: '', code: '', description: '' }

function validateZone(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Name is required.'
  else if (form.name.trim().length > 150) errors.name = 'Name must be at most 150 characters.'
  if (!form.code.trim()) errors.code = 'Code is required.'
  else if (form.code.trim().length > 50) errors.code = 'Code must be at most 50 characters.'
  if (form.description.trim().length > 2000) errors.description = 'Description must be at most 2000 characters.'
  return errors
}

export default function FloorDetailsPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const canWrite = canManageInfrastructure(user)
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
    Promise.all([getFloor(id), listZones({ floorId: id, page, limit: 20 })])
      .then(([floorData, zones]) => {
        if (!ignore) {
          setFloor(floorData)
          setResult(zones)
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

  function openEdit(zone) {
    setForm({ name: zone.name, code: zone.code, description: zone.description || '' })
    setFormErrors({})
    setFormError('')
    setFormMode({ type: 'edit', id: zone.id })
  }

  async function submitForm(event) {
    event.preventDefault()
    const errors = validateZone(form)
    setFormErrors(errors)
    setFormError('')
    if (Object.keys(errors).length > 0) return
    const payload = { name: form.name.trim(), code: form.code.trim(), description: form.description.trim() || null }
    setSaving(true)
    try {
      if (formMode.type === 'create') {
        await createZone({ ...payload, floorId: id })
        setNotice('Zone created.')
      } else {
        await updateZone(formMode.id, payload)
        setNotice('Zone updated.')
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
      await deleteZone(pendingDelete.id)
      setPendingDelete(null)
      setNotice('Zone deleted.')
      setVersion((value) => value + 1)
    } catch (requestError) {
      setDeleteError(getErrorMessage(requestError))
    } finally {
      setDeleting(false)
    }
  }

  if (loading && !floor) return <LoadingState message="Loading floor..." />
  if (error || !floor) return <ErrorState message={error || 'The requested information could not be found.'} />

  const items = result?.items || []
  const building = floor.building

  return (
    <section>
      <Breadcrumbs
        items={[
          { label: 'Buildings', to: '/buildings' },
          { label: building.name, to: `/buildings/${building.id}` },
          { label: floor.name },
        ]}
      />
      <div className="page-heading">
        <div>
          <h1>{floor.name}</h1>
          <p className="lede">Floor {floor.floorNumber}</p>
        </div>
        {canWrite ? <button type="button" className="button button-primary" onClick={openCreate}>Add zone</button> : null}
      </div>
      {floor.description ? <p>{floor.description}</p> : null}
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      <h2>Zones</h2>
      {items.length === 0 ? <EmptyState message="No zones found." /> : (
        <>
          <DataTable
            rowKey={(zone) => zone.id}
            rows={items}
            columns={[
              { key: 'name', header: 'Name', render: (zone) => zone.name },
              { key: 'code', header: 'Code', render: (zone) => zone.code },
              { key: 'description', header: 'Description', render: (zone) => zone.description || '—' },
              { key: 'rooms', header: 'Rooms', render: (zone) => zone._count?.rooms ?? 0 },
              {
                key: 'actions',
                header: 'Actions',
                render: (zone) => (
                  <div className="row-actions">
                    <Link className="button button-quiet" to={`/zones/${zone.id}`}>View</Link>
                    {canWrite ? <button type="button" className="button button-quiet" onClick={() => openEdit(zone)}>Edit</button> : null}
                    {canWrite ? <button type="button" className="button button-danger" onClick={() => { setDeleteError(''); setPendingDelete(zone) }}>Delete</button> : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination page={result.pagination.page} total={result.pagination.total} totalPages={result.pagination.totalPages} onPage={setPage} />
        </>
      )}
      {formMode ? (
        <Modal title={formMode.type === 'create' ? 'Add zone' : 'Edit zone'} onClose={() => setFormMode(null)}>
          <form onSubmit={submitForm} noValidate>
            <FormField id="zone-name" label="Name" error={formErrors.name}>
              <input id="zone-name" value={form.name} maxLength={150} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </FormField>
            <FormField id="zone-code" label="Code" error={formErrors.code}>
              <input id="zone-code" value={form.code} maxLength={50} onChange={(event) => setForm({ ...form, code: event.target.value })} />
            </FormField>
            <FormField id="zone-description" label="Description" error={formErrors.description}>
              <textarea id="zone-description" rows={3} maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
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
          title="Delete zone"
          message={`Are you sure you want to delete ${pendingDelete.name}? Rooms in this zone are removed with it. The server will reject the delete if alarms or other records still depend on it.`}
          busy={deleting}
          error={deleteError}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  )
}
