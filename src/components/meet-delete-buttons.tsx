'use client'

import { DeleteConfirmationDialog } from './delete-confirmation-dialog'
import { deleteMeet } from '@/app/actions/delete-operations'

export function MeetDeleteActions({ meetId }: { meetId: string }) {
  const handleDeleteMeet = async () => {
    await deleteMeet(meetId)
    window.location.href = '/meets'
  }

  return (
    <div className="flex gap-2">
      <DeleteConfirmationDialog
        title="Delete Entire Meet"
        description="This will permanently delete this meet, all its races, and all associated results. This action cannot be undone."
        onConfirm={handleDeleteMeet}
        buttonText="Delete Meet"
      />
    </div>
  )
}