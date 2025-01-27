import { defineExtension, useCommand } from 'reactive-vscode'
import vscode from 'vscode'
import { logger } from './utils'

const { activate, deactivate } = defineExtension(() => useCommand('llm-compelete-me.please', async () => {
  const activeTextEditor = vscode.window.activeTextEditor
  if (!activeTextEditor)
    return vscode.window.showInformationMessage('No active text editor')
  const context = getContext(activeTextEditor)
  if (!context)
    vscode.window.showInformationMessage('No text available')
  // Insert new line before and after the response
  await activeTextEditor.edit(edit => edit.insert(activeTextEditor.selection.active, '\n'))
  await giveMeAnswer(activeTextEditor, context)
  await activeTextEditor.edit(edit => edit.insert(activeTextEditor.selection.active, '\n'))
}))

export { activate, deactivate }

function getContext(textEditor: vscode.TextEditor) {
  // if have selection, return selection
  const selectionText = textEditor?.document.getText(textEditor?.selection)
  if (selectionText)
    return selectionText
  // else return all text in active editor
  return textEditor?.document.getText()
}

// ref https://code.visualstudio.com/api/extension-guides/language-model#interpret-the-response
async function giveMeAnswer(textEditor: vscode.TextEditor, q: string) {
  const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'claude-3.5-sonnet' })
  let chatResponse: vscode.LanguageModelChatResponse | undefined
  const messages = [vscode.LanguageModelChatMessage.User(q)]
  try {
    chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token)
  }
  catch (err) {
    if (err instanceof vscode.LanguageModelError)
      logger.error(err.message, err.code, err.cause)
    else
      throw err
  }

  if (!chatResponse) {
    vscode.window.showInformationMessage('No response from the language model')
    return
  }
  try {
    // Stream the code into the editor as it is coming in from the Language Model
    for await (const fragment of chatResponse.text)
      await textEditor.edit(edit => edit.insert(textEditor.selection.active, fragment))
  }
  catch (err) {
    // async response stream may fail, e.g network interruption or server side error
    await textEditor.edit(edit => edit.insert(textEditor.selection.active, (<Error>err).message))
  }
}
