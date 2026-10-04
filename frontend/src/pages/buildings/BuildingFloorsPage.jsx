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
import { getBuilding } from '../../services/building.service'
import { createFloor, deleteFloor, listFloors, updateFloor } from '../../services/floor.service'
import { canManageInfrastructure } from '../../utils/access'
import { getErrorMessage, getFieldErrors } from '../../utils/errors'

const EMPTY_FORM = { name: '', floorNumber: '', description: '' }

function validateFloor(form) {
  const errors = {}
  const number = Number(form.floorNumber)

  if (!form.name.trim()) errors.name = 'Name is required.'
  else if (form.name.trim().length > 150) errors.name = 'Name must be at most 150 characters.'

  if (form.floorNumber === '' || !Number.isInteger(number) || number < -50 || number > 200) {
    errors.floorNumber = 'Floor number must be a whole number from -50 to 200.'
  }

  if (form.description.trim().length > 2000) errors.description = 'Description must be at most 2000 characters.'
  return errors
}

export default function BuildingFloorsPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const canWrite = canManageInfrastructure(user)
  const [building, setBuilding] = useState(null)
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
    Promise.all([getBuilding(id), listFloors({ buildingId: id, page, limit: 20 })])
      .then(([buildingData, floors]) => {
        if (!ignore) {
          setBuilding(buildingData)
          setResult(floors)
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

  function openEdit(floor) {
    setForm({ name: floor.name, floorNumber: String(floor.floorNumber), description: floor.description || '' })
    setFormErrors({})
    setFormError('')
    setFormMode({ type: 'edit', id: floor.id })
  }

  async function submitForm(event) {
    event.preventDefault()
    const errors = validateFloor(form)
    setFormErrors(errors)
    setFormError('')
    if (Object.keys(errors).length > 0) return

    const payload = {
      name: form.name.trim(),
      floorNumber: Number(form.floorNumber),
      description: form.description.trim() || null,
    }

    setSaving(true)
    try {
      if (formMode.type === 'create') {
        await createFloor({ ...payload, buildingId: id })
        setNotice('Floor created.')
      } else {
        await updateFloor(formMode.id, payload)
        setNotice('Floor updated.')
      }
      setFormMode(null)
      setVersion((value) => value + 1)
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
      await deleteFloor(pendingDelete.id)
      setNotice('Floor deleted.')
      setPendingDelete(null)
      setVersion((value) => value + 1)
    } catch (requestError) {
      setDeleteError(getErrorMessage(requestError))
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <LoadingState message="Loading floors..." />
  if (error) return <ErrorState message={error} />
  if (!building) return null

  const items = result?.items || []

  return (
    <section>
      <Breadcrumbs items={[{ label: 'Buildings', to: '/buildings' }, { label: building.name, to: `/buildings/${building.id}` }, { label: 'Floors' }]} />
      <div className="page-heading">
        <div>
          <h1>Floors</h1>
          <p className="lede">{building.name}</p>
        </div>
        {canWrite ? <button type="button" className="button button-primary" onClick={openCreate}>Add floor</button> : null}
      </div>
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      {items.length === 0 ? <EmptyState message="No floors found." /> : (
        <>
          <DataTable
            rowKey={(floor) => floor.id}
            rows={items}
            columns={[
              { key: 'name', header: 'Name', render: (floor) => floor.name },
              { key: 'number', header: 'Floor number', render: (floor) => floor.floorNumber },
              { key: 'description', header: 'Description', render: (floor) => floor.description || '—' },
              { key: 'zones', header: 'Zones', render: (floor) => floor._count?.zones ?? 0 },
              {
                key: 'actions',
                header: 'Actions',
                render: (floor) => (
                  <div className="row-actions">
                    <Link className="button button-quiet" to={`/floors/${floor.id}`}>View</Link>
                    {canWrite ? <button type="button" className="button button-quiet" onClick={() => openEdit(floor)}>Edit</button> : null}
                    {canWrite ? <button type="button" className="button button-danger" onClick={() => { setDeleteError(''); setPendingDelete(floor) }}>Delete</button> : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination page={result.pagination.page} total={result.pagination.total} totalPages={result.pagination.totalPages} onPage={setPage} />
        </>
      )}
      {formMode ? (
        <Modal title={formMode.type === 'create' ? 'Add floor' : 'Edit floor'} onClose={() => setFormMode(null)}>
          <form onSubmit={submitForm} noValidate>
            <FormField id="floor-name" label="Name" error={formErrors.name}>
              <input id="floor-name" value={form.name} maxLength={150} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </FormField>
            <FormField id="floor-number" label="Floor number" error={formErrors.floorNumber}>
              <input id="floor-number" inputMode="numeric" value={form.floorNumber} onChange={(event) => setForm({ ...form, floorNumber: event.target.value })} />
            </FormField>
            <FormField id="floor-description" label="Description" error={formErrors.description}>
              <textarea id="floor-description" rows={3} maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
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
          title="Delete floor"
          message={`Are you sure you want to delete ${pendingDelete.name}? Zones and rooms on this floor are removed with it. The server will reject the delete if other records still depend on it.`}
          busy={deleting}
          error={deleteError}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  )
}
