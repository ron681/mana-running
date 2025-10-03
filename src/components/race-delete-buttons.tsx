'use client'

import { DeleteConfirmationDialog } from './delete-confirmation-dialog'
import { deleteAllRaceResults, deleteRace, deleteResult } from '@/app/actions/delete-operations'

export function DeleteRaceActions({ raceId, meetId }: { raceId: string; meetId: string }) {
  const handleDeleteResults = async () => {
    await deleteAllRaceResults(raceId)
    window.location.reload()
  }

  const handleDeleteRace = async () => {
    await deleteRace(raceId, meetId)
    window.location.href = `/meets/${meetId}`
  }

  return (
    <div className="flex gap-2">
      <DeleteConfirmationDialog
        title="Delete All Results"
        description="This will permanently delete all results from this race. This action cannot be undone."
        onConfirm={handleDeleteResults}
        buttonText="Delete Results"
      />
      <DeleteConfirmationDialog
        title="Delete Entire Race"
        description="This will permanently delete this race and all its results. This action cannot be undone."
        onConfirm={handleDeleteRace}
        buttonText="Delete Race"
      />
    </div>
  )
}

export function DeleteResultButton({ resultId, raceId }: { resultId: string; raceId: string }) {
  const handleDelete = async () => {
    await deleteResult(resultId, raceId)
    window.location.reload()
  }

  return (
    <DeleteConfirmationDialog
      title="Delete Result"
      description="This will permanently delete this athlete's result. This action cannot be undone."
      onConfirm={handleDelete}
      buttonText=""
      size="icon"
    />
  )
}