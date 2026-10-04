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
import { useAuth } from '../../hooks/useAuth'
import { createBuilding, deleteBuilding, listBuildings, updateBuilding } from '../../services/building.service'
import { canDeleteBuilding, canManageInfrastructure } from '../../utils/access'
import { getErrorMessage, getFieldErrors } from '../../utils/errors'
import { formatDate } from '../../utils/format'

const EMPTY_FORM = { name: '', code: '', address: '', description: '', status: 'ACTIVE' }

function readLimit(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 20 ? parsed : 10
}

function validateBuilding(form) {
  const errors = {}

  if (!form.name.trim()) errors.name = 'Name is required.'
  else if (form.name.trim().length > 150) errors.name = 'Name must be at most 150 characters.'

  if (!form.code.trim()) errors.code = 'Code is required.'
  else if (form.code.trim().length > 50) errors.code = 'Code must be at most 50 characters.'

  if (!form.address.trim()) errors.address = 'Address is required.'
  else if (form.address.trim().length > 300) errors.address = 'Address must be at most 300 characters.'

  if (form.description.trim().length > 2000) errors.description = 'Description must be at most 2000 characters.'
  if (form.status !== 'ACTIVE' && form.status !== 'INACTIVE') errors.status = 'Status must be ACTIVE or INACTIVE.'

  return errors
}

function toPayload(form) {
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    address: form.address.trim(),
    description: form.description.trim() || null,
    status: form.status,
  }
}

export default function BuildingsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const page = Math.max(Number(params.get('page')) || 1, 1)
  const status = params.get('status') || ''
  const search = params.get('search') || ''
  const limit = readLimit(params.get('limit'))
  const [searchInput, setSearchInput] = useState(search)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [formMode, setFormMode] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const canWrite = canManageInfrastructure(user)
  const canDelete = canDeleteBuilding(user)

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

    setLoading(true)
    listBuildings({ page, limit, search, status })
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
  }, [page, limit, search, status, reloadKey])

  function updateParam(key, value) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormErrors({})
    setFormError('')
    setFormMode({ type: 'create' })
  }

  function openEdit(building) {
    setForm({
      name: building.name,
      code: building.code,
      address: building.address,
      description: building.description || '',
      status: building.status,
    })
    setFormErrors({})
    setFormError('')
    setFormMode({ type: 'edit', id: building.id })
  }

  async function submitForm(event) {
    event.preventDefault()
    const errors = validateBuilding(form)
    setFormErrors(errors)
    setFormError('')
    if (Object.keys(errors).length > 0) return

    setSaving(true)
    try {
      if (formMode.type === 'create') {
        await createBuilding(toPayload(form))
        setNotice('Building created.')
      } else {
        await updateBuilding(formMode.id, toPayload(form))
        setNotice('Building updated.')
      }
      setFormMode(null)
      updateParam('page', page > 1 ? String(page) : '')
      const data = await listBuildings({ page, limit, search, status })
      setResult(data)
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
      await deleteBuilding(pendingDelete.id)
      setNotice('Building deleted.')
      setPendingDelete(null)
      const data = await listBuildings({ page, limit, search, status })
      setResult(data)
    } catch (requestError) {
      setDeleteError(getErrorMessage(requestError))
    } finally {
      setDeleting(false)
    }
  }

  const items = result?.items || []

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Buildings</h1>
          <p className="lede">Manage the buildings in this system.</p>
        </div>
        {canWrite ? (
          <button type="button" className="button button-primary" onClick={openCreate}>
            Add Building
          </button>
        ) : null}
      </div>
      {notice ? <p className="notice" role="status">{notice}</p> : null}
      <div className="toolbar">
        <label>
          Search
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Name or code"
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => updateParam('status', event.target.value)}>
            <option value="">All</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>
      </div>
      {loading ? <LoadingState message="Loading buildings..." /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} /> : null}
      {!loading && !error && items.length === 0 ? <EmptyState message="No buildings found." /> : null}
      {!loading && !error && items.length > 0 ? (
        <>
          <DataTable
            rowKey={(building) => building.id}
            rows={items}
            columns={[
              { key: 'name', header: 'Name', render: (building) => building.name },
              { key: 'code', header: 'Code', render: (building) => building.code },
              { key: 'address', header: 'Address', render: (building) => building.address },
              { key: 'status', header: 'Status', render: (building) => <StatusBadge status={building.status} /> },
              { key: 'floors', header: 'Floors', render: (building) => building._count?.floors ?? 0 },
              { key: 'created', header: 'Created', render: (building) => formatDate(building.createdAt) },
              {
                key: 'actions',
                header: 'Actions',
                render: (building) => (
                  <div className="row-actions">
                    <Link className="button button-quiet" to={`/buildings/${building.id}`}>View</Link>
                    {canWrite ? (
                      <button type="button" className="button button-quiet" onClick={() => openEdit(building)}>Edit</button>
                    ) : null}
                    {canDelete ? (
                      <button type="button" className="button button-danger" onClick={() => { setDeleteError(''); setPendingDelete(building) }}>Delete</button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            page={result.pagination.page}
            total={result.pagination.total}
            totalPages={result.pagination.totalPages}
            onPage={(nextPage) => updateParam('page', nextPage > 1 ? String(nextPage) : '')}
          />
        </>
      ) : null}
      {formMode ? (
        <Modal title={formMode.type === 'create' ? 'Add building' : 'Edit building'} onClose={() => setFormMode(null)}>
          <form onSubmit={submitForm} noValidate>
            <FormField id="building-name" label="Name" error={formErrors.name}>
              <input id="building-name" value={form.name} maxLength={150} aria-invalid={Boolean(formErrors.name)} aria-describedby={formErrors.name ? 'building-name-error' : undefined} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </FormField>
            <FormField id="building-code" label="Code" error={formErrors.code}>
              <input id="building-code" value={form.code} maxLength={50} aria-invalid={Boolean(formErrors.code)} aria-describedby={formErrors.code ? 'building-code-error' : undefined} onChange={(event) => setForm({ ...form, code: event.target.value })} />
            </FormField>
            <FormField id="building-address" label="Address" error={formErrors.address}>
              <input id="building-address" value={form.address} maxLength={300} aria-invalid={Boolean(formErrors.address)} aria-describedby={formErrors.address ? 'building-address-error' : undefined} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </FormField>
            <FormField id="building-description" label="Description" error={formErrors.description}>
              <textarea id="building-description" value={form.description} maxLength={2000} rows={3} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </FormField>
            <FormField id="building-status" label="Status" error={formErrors.status}>
              <select id="building-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
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
          title="Delete building"
          message={`Are you sure you want to delete ${pendingDelete.name}? Floors, zones, and rooms in this building are removed with it. The server will reject the delete if devices or alarms still depend on this building.`}
          busy={deleting}
          error={deleteError}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  )
}
