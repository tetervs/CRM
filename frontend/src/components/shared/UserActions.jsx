import { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import { EditUserModal } from './EditUserModal'
import useAuthStore from '../../store/authStore'
import api from '../../api/index'

// Edit / Deactivate / Delete for one user row, shared by Team and Employees.
// Same rules as the backend: head + admin; only a head may act on head accounts;
// never on yourself; hard delete is head-only. Extra row buttons go in `children`.
export function UserActions({ member, onChanged, children }) {
  const me = useAuthStore((s) => s.user)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [counts, setCounts] = useState(null)
  const [busy, setBusy] = useState(false)

  const isSelf = member._id === me?._id
  const canAct = ['head', 'admin'].includes(me?.role) && (member.role !== 'head' || me.role === 'head')
  const canDelete = me?.role === 'head' && !isSelf

  const toggleActive = async () => {
    try {
      await api.patch(`/users/${member._id}`, { isActive: !member.isActive })
      onChanged()
    } catch (err) {
      setNotice(err.response?.data?.message || 'Could not update status.')
    }
  }

  const openDelete = () => { setConfirmEmail(''); setCounts(null); setDeleting(true) }

  const handleDelete = async () => {
    setBusy(true)
    try {
      await api.delete(`/users/${member._id}/permanent`, { data: { confirmEmail } })
      setDeleting(false)
      onChanged()
    } catch (err) {
      if (err.response?.status === 409) setCounts(err.response.data.counts)
      else setNotice(err.response?.data?.message || 'Could not delete user.')
    } finally {
      setBusy(false)
    }
  }

  const deactivateInstead = async () => { setDeleting(false); await toggleActive() }

  return (
    <div className="flex items-center gap-2">
      {canAct && <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>}
      {children}
      {canAct && !isSelf && (
        <Button variant={member.isActive ? 'danger' : 'secondary'} size="sm" onClick={toggleActive}>
          {member.isActive ? 'Deactivate' : 'Reactivate'}
        </Button>
      )}
      {canDelete && <Button variant="ghost" size="sm" onClick={openDelete}>Delete</Button>}

      {editing && <EditUserModal user={member} onClose={() => setEditing(false)} onSaved={onChanged} />}

      <Modal isOpen={!!notice} onClose={() => setNotice('')} title="Can't complete that">
        <div className="space-y-4">
          <p className="text-sm text-slate-700">{notice}</p>
          <div className="flex justify-end"><Button variant="primary" size="sm" onClick={() => setNotice('')}>OK</Button></div>
        </div>
      </Modal>

      <Modal isOpen={deleting} onClose={() => setDeleting(false)} title={`Delete ${member.name}`}>
        {counts ? (
          <div className="space-y-4">
            <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-md space-y-1">
              <p className="text-sm font-medium text-amber-800">Has activity — deactivate instead</p>
              <ul className="text-xs text-amber-700 list-disc pl-4">
                {Object.entries(counts).map(([k, n]) => <li key={k}>{k}: {n}</li>)}
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDeleting(false)}>Close</Button>
              {member.isActive && <Button variant="danger" size="sm" onClick={deactivateInstead}>Deactivate</Button>}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              This permanently removes the account and can't be undone. Type <strong>{member.email}</strong> to confirm.
            </p>
            <Input label="Email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder={member.email} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDeleting(false)}>Cancel</Button>
              <Button variant="danger" size="sm" loading={busy}
                disabled={confirmEmail.trim().toLowerCase() !== member.email.toLowerCase()} onClick={handleDelete}>
                Delete permanently
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
