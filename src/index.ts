import { defineConfigObject, defineExtension, useCommand } from 'reactive-vscode'
import vscode from 'vscode'
import { logger } from './utils'

const config = defineConfigObject('llm-complete-me', { useCopilot: Boolean, baseURL: [String, null], apiKey: [String, null], model: [String, null], selectedModel: [String, null] })

const { activate, deactivate } = defineExtension((): void => {
  useCommand('llm-complete-me.please', async () => {
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
      await vscode.window.withProgress({ title: 'Completing...', location: vscode.ProgressLocation.Notification }, async () => await giveMeAnswerCopilot(activeTextEditor, context))
    else
      await vscode.window.withProgress({ title: 'Completing...', location: vscode.ProgressLocation.Notification }, async () => await getAnswer(activeTextEditor, context))
    await activeTextEditor.edit(edit => edit.insert(activeTextEditor.selection.active, '\n'))
  })

  useCommand('llm-complete-me.select-model', selectCopilotModel)
})

export { activate, deactivate }

async function selectCopilotModel() {
  const models = await vscode.lm.selectChatModels({ vendor: 'copilot' })
  if (!models.length) {
    vscode.window.showErrorMessage('No Copilot models available')
    return null
  }
  const modelItems = models.map(m => ({ label: m.name, detail: m.id, model: m }))
  const selectedItem = await vscode.window.showQuickPick(modelItems, { placeHolder: 'Select a model' })
  if (selectedItem) {
    config.selectedModel = selectedItem.model.id
    return selectedItem.model
  }
  return null
}

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
  const startPosition = textEditor.selection.active

  let model
  if (config.selectedModel) {
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' })
    model = models.find(m => m.id === config.selectedModel)
  }

  if (!model) {
    model = await selectCopilotModel()
    if (!model) {
      return vscode.window.showErrorMessage('No model selected')
    }
  }

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

    // Select the generated content
    const endPosition = textEditor.selection.active
    textEditor.selection = new vscode.Selection(startPosition, endPosition)
  }
  catch (err) {
    // async response stream may fail, e.g network interruption or server side error
    await textEditor.edit(edit => edit.insert(textEditor.selection.active, (err as Error).message))
  }
}

async function getAnswer(textEditor: vscode.TextEditor, context: string) {
  const startPosition = textEditor.selection.active
  try {
    const res = await fetch(`${config.baseURL}/chat/completions`, {
      body: JSON.stringify({ messages: [{ content: context, role: 'user' }], model: config.model }),
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      method: 'POST',
    })

    if (!res.ok) {
      const errorData = await res.json() as { error?: { message?: string } }

      // Simple check for model not supported error
      if (res.status === 400 && errorData?.error?.message?.includes('Model is not supported')) {
        await textEditor.edit(edit => edit.insert(
          textEditor.selection.active,
          `Error: Model "${config.model}" not supported. Run command "llm-complete-me.select-model" to select a different model.`,
        ))
        return
      }

      throw new Error(`Request failed: ${res.status} ${JSON.stringify(errorData)}`)
    }

    const jsonResponse = await res.json() as { choices?: { message?: { content?: string } }[] }
    const content = jsonResponse?.choices?.[0]?.message?.content
    if (!content)
      return vscode.window.showInformationMessage('No response from the language model')
    await textEditor.edit(edit => edit.insert(textEditor.selection.active, content))

    // Select the generated content
    const endPosition = textEditor.selection.active
    textEditor.selection = new vscode.Selection(startPosition, endPosition)
  }
  catch (err) {
    await textEditor.edit(edit => edit.insert(textEditor.selection.active, `Error: ${(err as Error).message}`))
  }
}
