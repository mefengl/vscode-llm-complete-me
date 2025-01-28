import { defineConfigObject, defineExtension, useCommand } from 'reactive-vscode'
import vscode from 'vscode'
import { ofetch } from 'ofetch'
import { logger } from './utils'

const config = defineConfigObject('llm-complete-me', { useCopilot: Boolean, baseURL: [String, null], apiKey: [String, null], model: [String, null] })

const { activate, deactivate } = defineExtension(() => useCommand('llm-complete-me.please', async () => {
  if (!config.useCopilot && (!config.baseURL || !config.apiKey || !config.model)) {
    const baseURL = await vscode.window.showInputBox({ prompt: 'Enter the base URL of the language model, or enter "copilot" if you have copilot subscription', value: config.baseURL ?? undefined })
    if (!baseURL)
      return vscode.window.showInformationMessage('No base URL provided')
    if (baseURL === 'copilot') {
      config.useCopilot = true
    }
    else {
      config.baseURL = baseURL.trim().replace(/\/$/, '')
      const apiKey = await vscode.window.showInputBox({ prompt: 'Enter the API key of the language model', value: config.apiKey ?? undefined })
      if (!apiKey)
        return vscode.window.showInformationMessage('No API key provided')
      config.apiKey = apiKey
      const model = await vscode.window.showInputBox({ prompt: 'Enter the model of the language model', value: config.model ?? undefined, password: true })
      if (!model)
        return vscode.window.showInformationMessage('No model provided')
      config.model = model
    }
  }

  const activeTextEditor = vscode.window.activeTextEditor
  if (!activeTextEditor)
    return vscode.window.showInformationMessage('No active text editor')
  const context = getContext(activeTextEditor)
  if (!context)
    vscode.window.showInformationMessage('No text available')
  await activeTextEditor.edit(edit => edit.insert(activeTextEditor.selection.active, '\n'))
  if (config.useCopilot)
    await vscode.window.withProgress({ title: 'Compeleting...', location: vscode.ProgressLocation.Notification }, async () => await giveMeAnswerCopilot(activeTextEditor, context))
  else
    await vscode.window.withProgress({ title: 'Compeleting...', location: vscode.ProgressLocation.Notification }, async () => await getAnswer(activeTextEditor, context))
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
async function giveMeAnswerCopilot(textEditor: vscode.TextEditor, q: string) {
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

  if (!chatResponse)
    return vscode.window.showInformationMessage('No response from the language model')
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

async function getAnswer(textEditor: vscode.TextEditor, context: string) {
  try {
    const res = await ofetch(`${config.baseURL}/chat/completions`, {
      body: JSON.stringify({ messages: [{ content: context, role: 'user' }], model: config.model }),
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      method: 'POST',
    })
    const chatResponse = res?.choices?.[0]?.message
    if (!chatResponse)
      return vscode.window.showInformationMessage('No response from the language model')
    await textEditor.edit(edit => edit.insert(textEditor.selection.active, chatResponse.content))
  }
  catch (err) {
    return vscode.window.showInformationMessage((<Error>err).message)
  }
}
