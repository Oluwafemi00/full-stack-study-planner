import { useApp } from "../context/AppContext";
import FileLibrary from "./FileLibrary";
import FileViewer from "./FileViewer";

export default function StudyAssistant() {
  const { state } = useApp();

  // If there is an active file ID in global state, show the viewer
  if (state.activeFileId) {
    return <FileViewer />;
  }

  // Otherwise, show the library
  return <FileLibrary />;
}
