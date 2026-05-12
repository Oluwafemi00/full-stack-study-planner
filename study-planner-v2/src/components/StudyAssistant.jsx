import { useState } from 'react'
import FileLibrary from './FileLibrary'
import FileViewer  from './FileViewer'

export default function StudyAssistant() {
  const [openFile, setOpenFile] = useState(null)

  if (openFile) {
    return (
      <FileViewer
        file={openFile}
        onBack={() => setOpenFile(null)}
      />
    )
  }

  return (
    <FileLibrary onOpenFile={setOpenFile} />
  )
}
