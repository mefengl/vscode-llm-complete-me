import { defineExtension, useCommand } from 'reactive-vscode'
import { window } from 'vscode'

const { activate, deactivate } = defineExtension(() => useCommand('llm-compelete-me', () => {
  window.showInformationMessage(context() || 'No text available')
}))

export { activate, deactivate }

function context() {
  const activeTextEditor = window.activeTextEditor
  // if have selection, return selection
  const selectionText = activeTextEditor?.document.getText(activeTextEditor?.selection)
  if (selectionText)
    return selectionText
  // else return all text in active editor
  return activeTextEditor?.document.getText()
}
